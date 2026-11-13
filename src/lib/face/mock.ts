import type { FaceProvider } from "./index";

/**
 * TEST MODE face provider. It does not look at the photo at all:
 * the scan screen shows a list of enrolled employees and the tester picks who "was recognised".
 * Never use in production (FACE_PROVIDER=aws there).
 */
export const mockFace: FaceProvider = {
  name: "mock",
  async enroll(_businessId, employeeId, images) {
    return { ok: true, faceIds: images.map((_, i) => (i === 0 ? `mock-${employeeId}` : `mock-${employeeId}-${i + 1}`)) };
  },
  async search(_businessId, _image, mockEmployeeId) {
    if (!mockEmployeeId) return { ok: false, reason: "no_match", message: "Test mode: pick an employee" };
    return { ok: true, employeeId: mockEmployeeId, similarity: 99.9 };
  },
  async remove() {},
};
