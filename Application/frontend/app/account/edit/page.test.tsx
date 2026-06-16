import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import EditProfilePage from "@/app/account/edit/page";

const { updateProfile, uploadAvatar, removeAvatar, changePassword, authUser } = vi.hoisted(() => ({
  updateProfile: vi.fn(),
  uploadAvatar: vi.fn(),
  removeAvatar: vi.fn(),
  changePassword: vi.fn(),
  authUser: {
    user_id: 1, full_name: "John Doe", phone_number: "0901234567",
    address: "123 Main St", avatar_url: null, role: "customer",
  } as Record<string, unknown>,
}));

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ user: authUser, loading: false, updateProfile, uploadAvatar, removeAvatar, changePassword }),
}));

describe("EditProfilePage", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it("saves name + address via updateProfile", async () => {
    updateProfile.mockResolvedValue(authUser);
    render(<EditProfilePage />);
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Jane Roe" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ full_name: "Jane Roe" })));
  });

  it("disables the phone field", () => {
    render(<EditProfilePage />);
    expect(screen.getByLabelText(/phone/i)).toBeDisabled();
  });

  it("rejects a too-short new password before calling the API", async () => {
    render(<EditProfilePage />);
    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: "oldpass123" } });
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith(expect.stringMatching(/at least 8/i)));
    expect(changePassword).not.toHaveBeenCalled();
  });
});