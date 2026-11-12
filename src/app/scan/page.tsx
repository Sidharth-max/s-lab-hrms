import Link from "next/link";
import { getDevice } from "@/lib/auth";
import { Scanner } from "./Scanner";

export default async function ScanPage() {
  const device = await getDevice();
  if (!device) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-4 text-center">
        <h1 className="h1">Scanner not set up</h1>
        <p className="muted">
          {"This device is not registered for attendance. The owner or a manager must log in once on this device and choose “Make this device a scanner” under Devices."}
        </p>
        <Link href="/login" className="btn-primary">Manager / owner login</Link>
      </main>
    );
  }
  return <Scanner />;
}
