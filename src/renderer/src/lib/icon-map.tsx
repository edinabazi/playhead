"use client";

import type { ComponentType } from "react";
import {
  ArrowRight,
  Bell,
  Brain,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  Circle,
  Clock,
  Copy,
  Dot,
  Globe,
  Heart,
  ImageIcon,
  Info,
  Keyboard,
  ListMusic,
  ListPlus,
  Lightbulb,
  Link,
  Loader,
  Lock,
  Mail,
  Menu,
  Ellipsis,
  FolderOpen,
  FolderPlus,
  FolderSearch,
  ListFilter,
  Minimize2,
  Monitor,
  Moon,
  Music,
  Paintbrush,
  Palette,
  Pause,
  Play,
  Plus,
  RectangleHorizontal,
  Repeat,
  Rocket,
  RotateCcw,
  Search,
  Settings,
  Shield,
  Shuffle,
  SkipForward,
  SquareLibrary,
  Star,
  Sun,
  Trash2,
  User,
  Users,
  Volume2,
  AudioWaveform,
  X,
  Pencil,
} from "lucide-react";

export interface IconComponentProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
  fill?: string;
}

export type IconComponent = ComponentType<IconComponentProps>;
export type IconLibrary = "lucide";

export type IconName =
  | "chevron-left"
  | "chevron-right"
  | "chevrons-down-up"
  | "x"
  | "copy"
  | "menu"
  | "ellipsis"
  | "dot"
  | "monitor"
  | "sun"
  | "moon"
  | "rectangle-horizontal"
  | "circle"
  | "square-library"
  | "clock"
  | "star"
  | "settings"
  | "pencil"
  | "trash-2"
  | "plus"
  | "arrow-right"
  | "search"
  | "loader"
  | "users"
  | "lock"
  | "mail"
  | "bell"
  | "shield"
  | "palette"
  | "lightbulb"
  | "rocket"
  | "heart"
  | "paintbrush"
  | "brain"
  | "globe"
  | "user"
  | "image"
  | "keyboard"
  | "link"
  | "check"
  | "rotate-ccw"
  | "info"
  | "list-plus"
  | "folder-open"
  | "folder-plus"
  | "folder-search"
  | "list-filter"
  | "minimize-2"
  | "play"
  | "pause"
  | "list-music"
  | "music"
  | "shuffle"
  | "skip-forward"
  | "volume-2"
  | "audio-waveform"
  | "repeat";

export const iconLibraryOrder: IconLibrary[] = ["lucide"];

export const iconLibraryLabels: Record<IconLibrary, string> = {
  lucide: "Lucide",
};

const lucideMap: Record<IconName, IconComponent> = {
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "chevrons-down-up": ChevronsDownUp,
  x: X,
  copy: Copy,
  menu: Menu,
  ellipsis: Ellipsis,
  dot: Dot,
  monitor: Monitor,
  sun: Sun,
  moon: Moon,
  "rectangle-horizontal": RectangleHorizontal,
  circle: Circle,
  "square-library": SquareLibrary,
  clock: Clock,
  star: Star,
  settings: Settings,
  pencil: Pencil,
  "trash-2": Trash2,
  plus: Plus,
  "arrow-right": ArrowRight,
  search: Search,
  loader: Loader,
  users: Users,
  lock: Lock,
  mail: Mail,
  bell: Bell,
  shield: Shield,
  palette: Palette,
  lightbulb: Lightbulb,
  rocket: Rocket,
  heart: Heart,
  paintbrush: Paintbrush,
  brain: Brain,
  globe: Globe,
  user: User,
  image: ImageIcon,
  keyboard: Keyboard,
  info: Info,
  "list-plus": ListPlus,
  "folder-open": FolderOpen,
  "folder-plus": FolderPlus,
  "folder-search": FolderSearch,
  "list-filter": ListFilter,
  "minimize-2": Minimize2,
  link: Link,
  check: Check,
  "rotate-ccw": RotateCcw,
  play: Play,
  pause: Pause,
  "list-music": ListMusic,
  music: Music,
  shuffle: Shuffle,
  "skip-forward": SkipForward,
  "volume-2": Volume2,
  "audio-waveform": AudioWaveform,
  repeat: Repeat,
};

export const iconMap: Record<IconLibrary, Record<IconName, IconComponent>> = {
  lucide: lucideMap,
};
