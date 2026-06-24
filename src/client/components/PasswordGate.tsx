import { Box, Input, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { authenticate } from "../api";
import { getAuthToken, setAuthToken } from "../auth";

type PasswordGateProps = {
  children: React.ReactNode;
};

export function PasswordGate({ children }: PasswordGateProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(getAuthToken()));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      inputRef.current?.focus();
    }
  }, [isAuthenticated]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextPassword = password.trim();
    if (!nextPassword || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { token } = await authenticate(nextPassword);
      setAuthToken(token);
      setIsAuthenticated(true);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Access denied.");
      setPassword("");
      inputRef.current?.focus();
    } finally {
      setIsLoading(false);
    }
  }

  if (isAuthenticated) {
    return children;
  }

  return (
    <Box className="shell">
      <Box className="stage password-stage">
        <form className="prompt" onSubmit={handleSubmit}>
          <Input
            ref={inputRef}
            aria-label="Password"
            autoComplete="current-password"
            className="claim-input"
            disabled={isLoading}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={isLoading ? "" : "password"}
            spellCheck={false}
            type="password"
            value={password}
          />
        </form>

        <Box aria-live="polite" className="answer-slot">
          {isLoading ? (
            <Text className="processing">checking</Text>
          ) : error ? (
            <Text className="answer error">{error}</Text>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
}
