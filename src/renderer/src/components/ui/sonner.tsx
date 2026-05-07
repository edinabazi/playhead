import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "rgba(10,10,10,0.96)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "rgba(10,10,10,0.96)",
          "--success-text": "var(--foreground)",
          "--success-border": "var(--border)",
          "--info-bg": "rgba(10,10,10,0.96)",
          "--info-text": "var(--foreground)",
          "--info-border": "var(--border)",
          "--border-radius": "18px",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
