import { decideApproval, giveAdvance, sendApprovalOtp, verifyApprovalOtp } from "@/app/actions/advances";
import { addManualPunch, clearDayStatus, setDayStatus, voidPunch } from "@/app/actions/attendance";
import { enrollFace, removeFace, setEmployeeLeft, setEmployeeLogin, updateEmployee } from "@/app/actions/employees";
import { addAdjustment, lockPayrollAction, recalcPayroll, recordPayment, reopenPayrollAction } from "@/app/actions/payroll";
import { addHoliday, addSite, removeHoliday, revokeDevice, saveManager, toggleManager, toggleSite, updateSettings } from "@/app/actions/admin";
import type { ActionResult } from "@/lib/action";
import { actionResponse, apiError, readJson, staff, toForm } from "@/lib/api";

// The app calls the same actions as the website, so the rules and permission checks are identical.
const ACTIONS: Record<string, (prev: ActionResult, form: FormData) => Promise<ActionResult>> = {
  updateEmployee,
  enrollFace,
  removeFace,
  setEmployeeLeft,
  setEmployeeLogin,
  giveAdvance,
  decideApproval,
  sendApprovalOtp,
  verifyApprovalOtp,
  setDayStatus,
  clearDayStatus,
  addManualPunch,
  voidPunch,
  recalcPayroll,
  lockPayroll: lockPayrollAction,
  reopenPayroll: reopenPayrollAction,
  addAdjustment,
  recordPayment,
  revokeDevice,
  updateSettings,
  addSite,
  toggleSite,
  addHoliday,
  removeHoliday,
  saveManager,
  toggleManager,
};

export async function POST(req: Request, ctx: RouteContext<"/api/m/action/[name]">) {
  const { name } = await ctx.params;
  const action = Object.hasOwn(ACTIONS, name) ? ACTIONS[name] : undefined;
  if (!action) return apiError("Unknown action", 404);
  const body = await readJson(req);
  // Each action checks its own permission.
  return staff(async () => actionResponse(await action(null, toForm(body))));
}
