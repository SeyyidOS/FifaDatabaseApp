import React, { useState } from "react";

interface PasswordPromptProps {
  onSuccess: () => void;
}

const PasswordPrompt: React.FC<PasswordPromptProps> = ({ onSuccess }) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "admin123") {
      onSuccess();
    } else {
      setError("Incorrect password!");
    }
  };

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h2>Enter Admin Password</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: "8px", marginBottom: "10px" }}
        />
        <br />
        <button type="submit" style={{ padding: "8px 16px" }}>Submit</button>
      </form>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
};

export default PasswordPrompt;
