// Tabler ships one file per icon (so Metro bundles only what is imported) but no per-file types.
declare module "@tabler/icons-react-native/*" {
  import type { Icon } from "@tabler/icons-react-native";
  const icon: Icon;
  export default icon;
}
