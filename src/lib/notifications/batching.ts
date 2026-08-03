/**
 * Batching policy for outbound notifications.
 *
 * The rule the Product Bible cares about is "never flood a follower": if a
 * single dispatch window would send someone a pile of emails, they get one
 * grouped email instead. That discipline used to cover price alerts only, so a
 * multi-release day sent one launch email per game per follower.
 *
 * Alerts are bucketed into *groups* and each group batches independently. A
 * launch digest and a price digest are different emails on purpose — folding a
 * launch into a list of discounts buries the thing the product exists to tell
 * you about.
 */

export type BatchGroup = "price" | "launch";

const GROUP_BY_ALERT_TYPE: Record<string, BatchGroup> = {
  // Price movement — the commodity alerts. Batch aggressively.
  price_drop: "price",
  all_time_low: "price",
  sale_started: "price",
  sale_ending: "price",
  // Launch — the differentiator. Batched only when a genuine pile-up happens.
  out_now: "launch",
  release_today: "launch",
};

/**
 * Returns the batch group for an alert type, or null if the type should always
 * send individually (announcements, retro adds — rare and individually
 * meaningful, so grouping them would lose more than it saves).
 */
export function getBatchGroup(alertType: string): BatchGroup | null {
  return GROUP_BY_ALERT_TYPE[alertType] ?? null;
}

/**
 * Minimum alerts of one group, for one user, in one dispatch window before that
 * group collapses into a single digest email.
 *
 * Launch keeps its own threshold rather than sharing the price one: one game
 * launching should stay a dedicated email (the hero moment), but twenty games
 * flipping to released in the same window is noise no matter what they are.
 * These are tuned independently on purpose.
 */
export const BATCH_THRESHOLDS: Record<BatchGroup, number> = {
  price: 5,
  launch: 5,
};

/** Digests send in this order so the launch email lands first. */
const GROUP_PRIORITY: BatchGroup[] = ["launch", "price"];

export interface DigestPlan<T> {
  group: BatchGroup;
  items: T[];
}

export interface DispatchPlan<T> {
  /** Groups that hit their threshold — one grouped email each. */
  digests: DigestPlan<T>[];
  /** Everything else — one email per item, in the order it arrived. */
  individual: T[];
}

/**
 * Decides, for a single user's pending alerts, which collapse into digests and
 * which send individually. Pure and generic over the item type so it can be
 * exercised without touching Supabase or Resend.
 *
 * Groups never merge: 6 price alerts and 6 launch alerts produce two digests,
 * not one. A group under its threshold sends individually even if another group
 * batched.
 */
export function planUserDispatch<T>(
  items: T[],
  alertTypeOf: (item: T) => string,
  thresholds: Record<BatchGroup, number> = BATCH_THRESHOLDS
): DispatchPlan<T> {
  // Resolve each item's group once — alertTypeOf is caller-supplied and shouldn't
  // be assumed cheap or side-effect free.
  const groups = items.map((item) => getBatchGroup(alertTypeOf(item)));

  const byGroup = new Map<BatchGroup, T[]>();
  items.forEach((item, i) => {
    const group = groups[i];
    if (group === null) return;
    const list = byGroup.get(group);
    if (list) list.push(item);
    else byGroup.set(group, [item]);
  });

  const digests: DigestPlan<T>[] = [];
  const batchedGroups = new Set<BatchGroup>();

  for (const group of GROUP_PRIORITY) {
    const groupItems = byGroup.get(group);
    if (groupItems && groupItems.length >= thresholds[group]) {
      digests.push({ group, items: groupItems });
      batchedGroups.add(group);
    }
  }

  // Anything not swept into a digest sends individually, in arrival order.
  const individual = items.filter((_, i) => {
    const group = groups[i];
    return group === null || !batchedGroups.has(group);
  });

  return { digests, individual };
}
