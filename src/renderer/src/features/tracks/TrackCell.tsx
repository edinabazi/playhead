export function TrackCell({
  role = "button",
  style,
  selected = false,
  dragging = false,
  draggable = false,
  trackId,
  dataQueueNowPlaying,
  children,
  onClick,
  onDoubleClick,
  onContextMenu,
  onKeyDown,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  className = "",
}: {
  role?: "button" | "row";
  style?: React.CSSProperties;
  selected?: boolean;
  dragging?: boolean;
  draggable?: boolean;
  trackId?: string;
  dataQueueNowPlaying?: boolean;
  className?: string;
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onDoubleClick?: React.MouseEventHandler<HTMLDivElement>;
  onContextMenu?: React.MouseEventHandler<HTMLDivElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  onDragStart?: React.DragEventHandler<HTMLDivElement>;
  onDragEnd?: React.DragEventHandler<HTMLDivElement>;
  onDragOver?: React.DragEventHandler<HTMLDivElement>;
  onDragLeave?: React.DragEventHandler<HTMLDivElement>;
  onDrop?: React.DragEventHandler<HTMLDivElement>;
}) {
  return (
    <div
      role={role}
      style={style}
      tabIndex={0}
      draggable={draggable}
      data-track-id={trackId}
      data-queue-now-playing={dataQueueNowPlaying}
      className={`group flex w-full min-w-0 items-center justify-between rounded-[16px] px-[10px] py-[7px] text-left transition-[opacity,transform] duration-150 ${
        selected ? "bg-[var(--surface-track-active)]" : "hover:bg-[var(--surface-track-hover)]"
      } ${dragging ? "scale-[0.99] opacity-35" : ""} ${className}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onKeyDown={onKeyDown}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {children}
    </div>
  );
}
