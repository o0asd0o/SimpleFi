import { createSignal } from "solid-js";
import { createMutation } from "@tanstack/solid-query";
import { clsx as cn } from "clsx";
import { login, register, resetPassword, type AuthResponse } from "../lib/api";

type Mode = "login" | "register" | "reset";

type LoginScreenProps = {
  onAuthSuccess: (response: AuthResponse) => void;
};

export default function LoginScreen(props: LoginScreenProps) {
  const [mode, setMode] = createSignal<Mode>("login");
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [name, setName] = createSignal("");
  const [passphrase, setPassphrase] = createSignal("");
  const [newPassword, setNewPassword] = createSignal("");
  const [resetDone, setResetDone] = createSignal(false);

  const loginMutation = createMutation(() => ({
    mutationFn: () => login(username(), password()),
    onSuccess: (data) => props.onAuthSuccess(data),
  }));

  const registerMutation = createMutation(() => ({
    mutationFn: () => register(username(), password(), name()),
    onSuccess: (data) => props.onAuthSuccess(data),
  }));

  const resetMutation = createMutation(() => ({
    mutationFn: () => resetPassword(username(), passphrase(), newPassword()),
    onSuccess: () => setResetDone(true),
  }));

  const switchMode = (m: Mode) => {
    setMode(m);
    setUsername("");
    setPassword("");
    setName("");
    setPassphrase("");
    setNewPassword("");
    setResetDone(false);
    loginMutation.reset();
    registerMutation.reset();
    resetMutation.reset();
  };

  const error = () =>
    loginMutation.error?.message ||
    registerMutation.error?.message ||
    resetMutation.error?.message ||
    null;

  const isPending = () =>
    loginMutation.isPending ||
    registerMutation.isPending ||
    resetMutation.isPending;

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (mode() === "login") loginMutation.mutate();
    else if (mode() === "register") registerMutation.mutate();
    else resetMutation.mutate();
  };

  const inputClass =
    "w-full px-4 py-3 bg-surface border border-dim rounded-xl text-fg placeholder:text-fg-3 focus:outline-none focus:border-purple-500 transition-colors";

  return (
    <div class="min-h-screen bg-app-bg text-fg flex flex-col items-center justify-center px-6">
      <div class="w-full max-w-sm">
        <h1 class="text-3xl font-bold text-center mb-2">SimpleFi</h1>
        <p class="text-fg-3 text-center text-sm mb-8">
          {mode() === "login"
            ? "Sign in to your account"
            : mode() === "register"
              ? "Create your account"
              : "Reset your password"}
        </p>

        {error() && (
          <div class="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error()}
          </div>
        )}

        {resetDone() ? (
          <div class="text-center">
            <p class="text-green-400 mb-4">Password updated successfully!</p>
            <button
              type="button"
              onClick={() => switchMode("login")}
              class="text-purple-400 hover:text-purple-300 text-sm"
            >
              Back to login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} class="space-y-4">
            <input
              type="text"
              placeholder="Username"
              value={username()}
              onInput={(e) => setUsername(e.currentTarget.value)}
              class={inputClass}
              autocomplete="username"
            />

            {mode() === "register" && (
              <input
                type="text"
                placeholder="Your name"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                class={inputClass}
              />
            )}

            {mode() === "reset" ? (
              <>
                <input
                  type="text"
                  placeholder="Recovery passphrase"
                  value={passphrase()}
                  onInput={(e) => setPassphrase(e.currentTarget.value)}
                  class={inputClass}
                />
                <input
                  type="password"
                  placeholder="New password"
                  value={newPassword()}
                  onInput={(e) => setNewPassword(e.currentTarget.value)}
                  class={inputClass}
                  autocomplete="new-password"
                />
              </>
            ) : (
              <input
                type="password"
                placeholder="Password"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                class={inputClass}
                autocomplete={
                  mode() === "register" ? "new-password" : "current-password"
                }
              />
            )}

            <button
              type="submit"
              disabled={isPending()}
              class={cn(
                "w-full py-3 rounded-xl font-medium transition-colors",
                isPending()
                  ? "bg-purple-600/50 text-white/50 cursor-not-allowed"
                  : "bg-purple-600 hover:bg-purple-500 text-white",
              )}
            >
              {isPending()
                ? "..."
                : mode() === "login"
                  ? "Sign In"
                  : mode() === "register"
                    ? "Create Account"
                    : "Reset Password"}
            </button>
          </form>
        )}

        <div class="mt-6 text-center text-sm text-fg-3 space-y-2">
          {mode() === "login" ? (
            <>
              <p>
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("register")}
                  class="text-purple-400 hover:text-purple-300"
                >
                  Sign up
                </button>
              </p>
              <p>
                <button
                  type="button"
                  onClick={() => switchMode("reset")}
                  class="text-purple-400 hover:text-purple-300"
                >
                  Forgot password?
                </button>
              </p>
            </>
          ) : (
            <p>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("login")}
                class="text-purple-400 hover:text-purple-300"
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
