export function IconButton({
  title,
  disabled,
  active,
  onClick,
  children,
}: {
  title: string;
  disabled?: boolean;
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={`no-drag grid size-9 place-items-center rounded-full transition duration-150 hover:bg-white/10 active:scale-[0.97] disabled:opacity-40 ${
        active ? "bg-white/10 text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
      title={title}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
