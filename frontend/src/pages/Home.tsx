import { motion } from "motion/react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, KeyRound, LockKeyhole, Scale, Swords, TrendingUp, X } from "lucide-react";
import { PublicLayout } from "../components/board/PublicLayout";
import { Avatar } from "../components/ui/Identity";
import { Checkbox, Field, PasswordInput, TextInput } from "../components/ui/form";
import { Button, Pill, Segmented } from "../components/ui/primitives";
import { useSessions } from "../hooks/useBoard";
import { ApiError, publicApi } from "../lib/api";
import { relativeTime } from "../lib/format";
import { removeSession, roleLabel, saveSession } from "../lib/session";

/** Accepts a board code ("kerems-crew") or a pasted invite link (".../#/b/kerems-crew/…"). */
function boardCode(input: string): string {
  const fromLink = input.match(/\/b\/([^/?#\s]+)/);
  return (fromLink ? fromLink[1] : input).trim().toLowerCase();
}

const errorText = (e: unknown, wrongPassword = "Wrong password") =>
  e instanceof ApiError && e.status === 401 ? wrongPassword : (e as Error).message;

function JoinForm() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const slug = boardCode(code);
    if (!slug || !password) return;
    setBusy(true);
    setError(null);
    try {
      const signIn = await publicApi.signIn(slug, password);
      saveSession(signIn, remember);
      navigate(`/b/${signIn.slug}`);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404 ? "No board with that code" : errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Board code or invite link" htmlFor="join-code" hint="Ask whoever runs the board for the link.">
        <TextInput
          id="join-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. friday-night"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </Field>
      <Field label="Password" htmlFor="join-password" error={error}>
        <PasswordInput
          id="join-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </Field>
      <Checkbox checked={remember} onChange={setRemember}>
        Remember this device
      </Checkbox>
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy} disabled={!code || !password}>
        Enter board <ArrowRight className="size-4" />
      </Button>
    </form>
  );
}

function CreateForm() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  const problem =
    name.trim().length < 2
      ? "Give the board a name"
      : password.length < 6
        ? "The board password needs at least 6 characters"
        : adminPassword.length < 6
          ? "The admin password needs at least 6 characters"
          : password === adminPassword
            ? "Use different board and admin passwords"
            : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (problem) return;
    setBusy(true);
    try {
      const signIn = await publicApi.createBoard({ name: name.trim(), password, adminPassword });
      saveSession(signIn, remember);
      toast.success(`${signIn.name} is ready`, { description: "Invite your friends from Settings." });
      navigate(`/b/${signIn.slug}/settings?welcome=1`);
    } catch (err) {
      toast.error("Couldn't create the board", { description: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Board name" htmlFor="create-name">
        <TextInput
          id="create-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Friday Night FIFA"
          maxLength={60}
        />
      </Field>
      <Field label="Board password" htmlFor="create-password" hint="Share it with your group: they can log matches.">
        <PasswordInput
          id="create-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </Field>
      <Field
        label="Admin password"
        htmlFor="create-admin"
        hint="Keep it to yourself: deleting, archiving and settings need it."
      >
        <PasswordInput
          id="create-admin"
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
          autoComplete="new-password"
        />
      </Field>
      <Checkbox checked={remember} onChange={setRemember}>
        Remember this device
      </Checkbox>
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy} disabled={!!problem}>
        Create board <ArrowRight className="size-4" />
      </Button>
      {problem && (name || password || adminPassword) && <p className="text-center text-xs text-muted">{problem}</p>}
    </form>
  );
}

function Feature({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-accent-text ring-1 ring-line">
        {icon}
      </span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-sm text-muted">{children}</p>
      </div>
    </div>
  );
}

export default function Home() {
  const sessions = useSessions();
  const [tab, setTab] = useState<"join" | "create">("join");

  return (
    <PublicLayout>
      {sessions.length > 0 && (
        <section className="mt-4 mb-12">
          <p className="label mb-3">On this device</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((s, i) => (
              <motion.div
                key={s.slug}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card card-hover group flex items-center gap-4 p-4"
              >
                <Link to={`/b/${s.slug}`} className="flex min-w-0 flex-1 items-center gap-4">
                  <Avatar name={s.name} size="lg" className="rounded-2xl" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{s.name}</span>
                    <span className="mt-1 flex items-center gap-2 text-xs text-muted">
                      <Pill tone={s.role === "admin" ? "accent" : "neutral"}>{roleLabel(s.role)}</Pill>
                      {relativeTime(new Date(s.savedAt))}
                    </span>
                  </span>
                </Link>
                <button
                  onClick={() => removeSession(s.slug)}
                  className="rounded-lg p-1.5 text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:bg-surface-2 hover:text-fg focus:opacity-100"
                  aria-label={`Forget ${s.name} on this device`}
                  title="Forget on this device"
                >
                  <X className="size-4" />
                </button>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <div className="grid items-start gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="pt-2 lg:pt-10">
          <p className="label text-accent-text">For FIFA nights with friends</p>
          <h1 className="display mt-4 text-6xl leading-[0.9] sm:text-7xl">
            Your league.
            <br />
            <span className="text-accent-text">Your rules.</span>
          </h1>
          <p className="mt-5 max-w-lg text-base text-muted">
            A private board for your group: every result, an Elo rating that rewards upsets, fair teams on
            demand and the bragging rights to go with it.
          </p>
          <div className="mt-9 grid gap-5 sm:grid-cols-2">
            <Feature icon={<TrendingUp className="size-4" />} title="Ratings that mean something">
              Elo with club strength, goal margins and upset bonuses.
            </Feature>
            <Feature icon={<Scale className="size-4" />} title="Fair teams in one tap">
              Balanced drafts that split up last game's partners.
            </Feature>
            <Feature icon={<Swords className="size-4" />} title="Rivalries and records">
              Head-to-heads, streaks, nemeses and the hall of records.
            </Feature>
            <Feature icon={<LockKeyhole className="size-4" />} title="Private by default">
              One password for the group, remembered on your devices.
            </Feature>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="card p-6 sm:p-8"
        >
          <div className="mb-6 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <KeyRound className="size-5 text-accent-text" />
              {tab === "join" ? "Join a board" : "Start a board"}
            </h2>
            <Segmented
              value={tab}
              onChange={setTab}
              size="sm"
              options={[
                { value: "join", label: "Join" },
                { value: "create", label: "Create" },
              ]}
            />
          </div>
          {tab === "join" ? <JoinForm /> : <CreateForm />}
        </motion.section>
      </div>
    </PublicLayout>
  );
}
