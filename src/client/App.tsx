import { Box, Input, Text } from "@chakra-ui/react";
import { ExternalLink } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";

import { requestRoast } from "./api";
import { OFF_TOPIC_ROAST, type EvidenceSource } from "../shared/schemas";

type Result = {
  id: string;
  message: string;
  explanation?: string;
  source?: EvidenceSource;
  tone: "answer" | "error";
};

const SESSION_ID_KEY = "vgn-session-id";

export default function App() {
  const [claim, setClaim] = useState("");
  const [submittedClaim, setSubmittedClaim] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(getSessionId);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleClaimChange(event: ChangeEvent<HTMLInputElement>) {
    const nextClaim = event.target.value;

    setClaim(nextClaim);

    if (result && nextClaim !== submittedClaim) {
      setResult(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextClaim = claim.trim();
    if (!nextClaim || isLoading) {
      return;
    }

    const id = crypto.randomUUID();
    setClaim(nextClaim);
    setSubmittedClaim(nextClaim);
    setIsLoading(true);
    setResult(null);

    try {
      const response = await requestRoast(nextClaim, sessionId);
      setResult({
        id,
        message: response.roast,
        explanation: response.explanation,
        source: response.evidenceSource,
        tone: "answer",
      });
    } catch (error) {
      setResult({
        id,
        message: error instanceof Error ? error.message : "Agent misfired.",
        tone: "error",
      });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }

  return (
    <Box className="shell">
      <Box className="stage">
        <form className="prompt" onSubmit={handleSubmit}>
          <Input
            ref={inputRef}
            aria-label="Claim"
            autoComplete="off"
            className="claim-input"
            disabled={isLoading}
            maxLength={500}
            onChange={handleClaimChange}
            placeholder={isLoading ? "" : "claim"}
            spellCheck={false}
            value={claim}
          />
        </form>

        <Box aria-busy={isLoading} aria-live="polite" className="answer-slot">
          {isLoading ? (
            <Text className="processing">processing</Text>
          ) : result ? (
            <Box className="result" key={result.id}>
              <Text className={`answer ${result.tone}`}>{result.message}</Text>
              {result.explanation && result.tone === "answer" ? (
                <Text className="explanation">{result.explanation}</Text>
              ) : null}
              {result.source &&
              result.tone === "answer" &&
              result.message !== OFF_TOPIC_ROAST ? (
                <a
                  className="source-link"
                  href={result.source.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  {result.source.tag}
                  <ExternalLink aria-hidden className="source-link-icon" size={12} strokeWidth={2} />
                </a>
              ) : null}
            </Box>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
}

function getSessionId() {
  const existing = window.sessionStorage.getItem(SESSION_ID_KEY);

  if (existing) {
    return existing;
  }

  const next = crypto.randomUUID().replaceAll("-", "_");
  window.sessionStorage.setItem(SESSION_ID_KEY, next);

  return next;
}
