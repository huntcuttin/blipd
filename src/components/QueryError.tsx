export default function QueryError({ subject = "data" }: { subject?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <p className="text-[#ff6874] text-sm font-medium mb-1">Failed to load {subject}</p>
      <p className="text-[#555555] text-xs">Check your connection and try again</p>
    </div>
  );
}
