// Tabler icons (replacing Phosphor), the same set as the Android app: one 24px outline grid,
// 1.75 stroke, rounded joins. Screens keep short names; each maps to one icon.
// Named imports from @tabler/icons-react are tree-shaken by Next (optimizePackageImports).
import {
  IconAlertCircle,
  IconArrowDown,
  IconArrowDownLeft,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconArrowUpRight,
  IconBeach,
  IconBuildingStore,
  IconCalendarCheck,
  IconCalendarEvent,
  IconCalendarMonth,
  IconCamera,
  IconCash,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconCircleCheck,
  IconCircleCheckFilled,
  IconCircleX,
  IconClock,
  IconCoins,
  IconCurrencyRupee,
  IconDeviceMobile,
  IconDownload,
  IconFaceId,
  IconHistory,
  IconHome,
  IconLayoutGrid,
  IconLogin2,
  IconLogout2,
  IconMinus,
  IconMoon,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconRosetteDiscountCheck,
  IconSearch,
  IconSettings,
  IconShare,
  IconSun,
  IconTrash,
  IconUserCog,
  IconUserPlus,
  IconUsers,
  IconWallet,
  IconX,
  type Icon,
  type IconProps,
} from "@tabler/icons-react";
import { createElement, type ComponentType } from "react";

export type IconType = ComponentType<IconProps>;

function s(I: Icon): IconType {
  const Wrapped = (p: IconProps) => createElement(I, { stroke: 1.75, ...p });
  Wrapped.displayName = I.displayName;
  return Wrapped;
}

export const ArrowDown = s(IconArrowDown);
export const ArrowDownLeft = s(IconArrowDownLeft);
export const ArrowLeft = s(IconArrowLeft);
export const ArrowRight = s(IconArrowRight);
export const ArrowUp = s(IconArrowUp);
export const ArrowUpRight = s(IconArrowUpRight);
export const BadgeCheck = s(IconRosetteDiscountCheck);
export const Beach = s(IconBeach);
export const Building = s(IconBuildingStore);
export const CalendarCheck = s(IconCalendarCheck);
export const CalendarDays = s(IconCalendarEvent);
export const CalendarRange = s(IconCalendarMonth);
export const Camera = s(IconCamera);
export const Cash = s(IconCash);
export const Check = s(IconCheck);
export const ChevronDown = s(IconChevronDown);
export const ChevronLeft = s(IconChevronLeft);
export const ChevronRight = s(IconChevronRight);
export const ChevronUp = s(IconChevronUp);
export const CircleAlert = s(IconAlertCircle);
export const CircleCheck = s(IconCircleCheck);
export const CircleCheckFilled = IconCircleCheckFilled as IconType;
export const CircleX = s(IconCircleX);
export const Clock = s(IconClock);
export const Coins = s(IconCoins);
export const Download = s(IconDownload);
export const Grid = s(IconLayoutGrid);
export const HandCoins = s(IconCoins);
export const History = s(IconHistory);
export const House = s(IconHome);
export const IndianRupee = s(IconCurrencyRupee);
export const LogIn = s(IconLogin2);
export const LogOut = s(IconLogout2);
export const Menu = s(IconLayoutGrid);
export const Minus = s(IconMinus);
export const Moon = s(IconMoon);
export const Pencil = s(IconPencil);
export const Plus = s(IconPlus);
export const RotateCcw = s(IconRefresh);
export const ScanFace = s(IconFaceId);
export const Search = s(IconSearch);
export const Settings = s(IconSettings);
export const Share2 = s(IconShare);
export const Smartphone = s(IconDeviceMobile);
export const Sun = s(IconSun);
export const Trash2 = s(IconTrash);
export const UserCog = s(IconUserCog);
export const UserPlus = s(IconUserPlus);
export const Users = s(IconUsers);
export const Wallet = s(IconWallet);
export const X = s(IconX);
