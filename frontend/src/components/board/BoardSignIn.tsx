import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Lock, SearchX } from "lucide-react";
import { ApiError, publicApi } from "../../lib/api";
import { saveSession } from "../../lib/session";
import { Avatar } from "../ui/Identity";
import { Checkbox, Field, PasswordInput } from "../ui/form";
import { Button, EmptyState, Skeleton } from "../ui/primitives";

export function BoardSignIn({ slug }: { slug: string }) {
  const info = useQuery({ queryKey: ["board-info", slug], queryFn: () => publicApi.board(slug), retry: false });
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError(null);
    try {
      const signIn = await publicApi.signIn(slug, password);
      saveSession(signIn, remember);
      toast.success(`Welcome to ${signIn.name}`, {
        description: signIn.role === "admin" ? "Signed in as admin" : undefined,
      });
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? "Wrong password" : (err as Error).message);
      setPassword("");
    } finally {
      setBusy(false);
    }
  };

  if (info.error) {
    const missing = info.error instanceof ApiError && info.error.status === 404;
    return (
      <div className="card mx-auto mt-10 max-w-md">
        <EmptyState
          icon={<SearchX className="size-5" />}
          title={missing ? "No board with that code" : "Can't reach the server"}
          description={missing ? `Check the link or code (“${slug}”) with whoever invited you.` : info.error.message}
          action={
            <Link to="/">
              <Button variant="secondary">
                <ArrowLeft className="size-4" /> All boards
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <motion.form
      onSubmit={submit}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card mx-auto mt-6 max-w-md p-7 sm:mt-14 sm:p-9"
    >
      <div className="flex flex-col items-center text-center">
        {info.data ? (
          <Avatar name={info.data.name} size="xl" className="rounded-3xl" />
        ) : (
          <Skeleton className="size-20 rounded-3xl" />
        )}
        <p className="label mt-5 flex items-center gap-1.5">
          <Lock className="size-3" /> Private board
        </p>
        <h1 className="display mt-2 text-4xl">{info.data?.name ?? " "}</h1>
        <p className="mt-2 text-sm text-muted">Enter the board password your group shared with you.</p>
      </div>
      <div className="mt-7 space-y-4">
        <Field label="Password" htmlFor="board-password" error={error}>
          <PasswordInput
            id="board-password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Checkbox checked={remember} onChange={setRemember}>
          Remember this device
          <span className="block text-xs text-faint">Stay signed in here; turn off on shared computers.</span>
        </Checkbox>
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy} disabled={!password}>
          Enter board
        </Button>
      </div>
      <Link to="/" className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted hover:text-fg">
        <ArrowLeft className="size-3.5" /> All boards
      </Link>
    </motion.form>
  );
}
