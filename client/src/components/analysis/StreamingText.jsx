export default function StreamingText({ text, isStreaming }) {
  return (
    <span className="text-slate-200 leading-relaxed">
      {text}
      {isStreaming && (
        <span className="inline-block w-0.5 h-4 bg-amber-400 ml-0.5 animate-pulse align-middle" />
      )}
    </span>
  );
}