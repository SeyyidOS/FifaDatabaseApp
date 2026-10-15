import { motion } from "motion/react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, KeyRound } from "lucide-react";
import { Checkbox, Field, PasswordInput, TextInput } from "../ui/form";
import { Button, Segmented } from "../ui/primitives";
import { useAccount } from "../../hooks/useAccount";
import { ApiError, publicApi } from "../../lib/api";
import { useT } from "../../hooks/useI18n";
import { defineMessages } from "../../lib/i18n";
import { saveSession } from "../../lib/session";

const m = defineMessages({
  en: {
    wrongPassword: "Wrong password",
    noBoard: "No board with that code",
    codeLabel: "Board code or invite link",
    codeHint: "Ask whoever runs the board for the link.",
    codePlaceholder: "e.g. friday-night",
    password: "Password",
    remember: "Remember this device",
    enter: "Enter board",
    needName: "Give the board a name",
    shortPassword: "The board password needs at least 6 characters",
    shortAdmin: "The admin password needs at least 6 characters",
    samePasswords: "Use different board and admin passwords",
    ready: "{name} is ready",
    readyHint: "Invite your friends from Settings.",
    createFailed: "Couldn't create the board",
    nameLabel: "Board name",
    namePlaceholder: "e.g. Friday Night League",
    boardPassword: "Board password",
    boardPasswordHint: "Share it with your group: they can log matches.",
    adminPassword: "Admin password",
    adminPasswordHint: "Keep it to yourself: deleting, archiving and settings need it.",
    create: "Create board",
    joinTitle: "Join a board",
    createTitle: "Start a board",
    joinTab: "Join",
    createTab: "Create",
  },
  tr: {
    wrongPassword: "Şifre yanlış",
    noBoard: "Bu kodla bir board yok",
    codeLabel: "Board kodu ya da davet linki",
    codeHint: "Linki board'u yöneten kişiden iste.",
    codePlaceholder: "ör. cuma-gecesi",
    password: "Şifre",
    remember: "Bu cihazı hatırla",
    enter: "Board'a gir",
    needName: "Board'a bir isim ver",
    shortPassword: "Board şifresi en az 6 karakter olmalı",
    shortAdmin: "Yönetici şifresi en az 6 karakter olmalı",
    samePasswords: "Board ve yönetici şifreleri farklı olmalı",
    ready: "{name} hazır",
    readyHint: "Arkadaşlarını Ayarlar'dan davet et.",
    createFailed: "Board oluşturulamadı",
    nameLabel: "Board adı",
    namePlaceholder: "ör. Cuma Gecesi Ligi",
    boardPassword: "Board şifresi",
    boardPasswordHint: "Grubunla paylaş: maç girebilirler.",
    adminPassword: "Yönetici şifresi",
    adminPasswordHint: "Kendine sakla: silme, arşivleme ve ayarlar için gerekir.",
    create: "Board oluştur",
    joinTitle: "Board'a katıl",
    createTitle: "Board kur",
    joinTab: "Katıl",
    createTab: "Kur",
  },
});

/** Accepts a board code ("kerems-crew") or a pasted invite link (".../#/b/kerems-crew/…"). */
function boardCode(input: string): string {
  const fromLink = input.match(/\/b\/([^/?#\s]+)/);
  return (fromLink ? fromLink[1] : input).trim().toLowerCase();
}

const errorText = (e: unknown, wrongPassword: string) =>
  e instanceof ApiError && e.status === 401 ? wrongPassword : (e as Error).message;

function JoinForm() {
  const t = useT(m);
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
      setError(err instanceof ApiError && err.status === 404 ? t("noBoard") : errorText(err, t("wrongPassword")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t("codeLabel")} htmlFor="join-code" hint={t("codeHint")}>
        <TextInput
          id="join-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t("codePlaceholder")}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </Field>
      <Field label={t("password")} htmlFor="join-password" error={error}>
        <PasswordInput
          id="join-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </Field>
      <Checkbox checked={remember} onChange={setRemember}>
        {t("remember")}
      </Checkbox>
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy} disabled={!code || !password}>
        {t("enter")} <ArrowRight className="size-4" />
      </Button>
    </form>
  );
}

function CreateForm() {
  const t = useT(m);
  const navigate = useNavigate();
  const account = useAccount();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  const problem =
    name.trim().length < 2
      ? t("needName")
      : password.length < 6
        ? t("shortPassword")
        : adminPassword.length < 6
          ? t("shortAdmin")
          : password === adminPassword
            ? t("samePasswords")
            : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (problem) return;
    setBusy(true);
    try {
      const signIn = await publicApi.createBoard({ name: name.trim(), password, adminPassword }, account?.token);
      saveSession(signIn, remember);
      if (account) queryClient.invalidateQueries({ queryKey: ["auth-boards"] });
      toast.success(t("ready", { name: signIn.name }), { description: t("readyHint") });
      navigate(`/b/${signIn.slug}/settings?welcome=1`);
    } catch (err) {
      toast.error(t("createFailed"), { description: errorText(err, t("wrongPassword")) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t("nameLabel")} htmlFor="create-name">
        <TextInput
          id="create-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("namePlaceholder")}
          maxLength={60}
        />
      </Field>
      <Field label={t("boardPassword")} htmlFor="create-password" hint={t("boardPasswordHint")}>
        <PasswordInput
          id="create-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </Field>
      <Field label={t("adminPassword")} htmlFor="create-admin" hint={t("adminPasswordHint")}>
        <PasswordInput
          id="create-admin"
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
          autoComplete="new-password"
        />
      </Field>
      <Checkbox checked={remember} onChange={setRemember}>
        {t("remember")}
      </Checkbox>
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy} disabled={!!problem}>
        {t("create")} <ArrowRight className="size-4" />
      </Button>
      {problem && (name || password || adminPassword) && <p className="text-center text-xs text-muted">{problem}</p>}
    </form>
  );
}

/** Join a board with its code and password, or start one. */
export function BoardForms() {
  const t = useT(m);
  const [tab, setTab] = useState<"join" | "create">("join");
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      className="card p-6 sm:p-8"
    >
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <KeyRound className="size-5 text-accent-text" />
          {tab === "join" ? t("joinTitle") : t("createTitle")}
        </h2>
        <Segmented
          value={tab}
          onChange={setTab}
          size="sm"
          options={[
            { value: "join", label: t("joinTab") },
            { value: "create", label: t("createTab") },
          ]}
        />
      </div>
      {tab === "join" ? <JoinForm /> : <CreateForm />}
    </motion.section>
  );
}
