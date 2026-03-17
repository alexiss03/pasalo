"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../../../lib/api";

type CaptureField = "id" | "selfie" | "authority_document";

type PublicCaptureSessionResponse = {
  item: {
    id: string;
    field_type: CaptureField;
    status: "pending" | "completed" | "expired" | "canceled";
    expires_at: string;
    captured_at: string | null;
  };
};

type CompleteCaptureResponse = {
  item: {
    id: string;
    field_type: CaptureField;
    status: "completed";
    captured_file_key: string;
    captured_file_name: string;
    captured_at: string;
  };
};

function getCaptureInstruction(field: CaptureField) {
  if (field === "id") {
    return "Capture a clear, full-frame photo of your valid ID.";
  }
  if (field === "selfie") {
    return "Capture a selfie while holding your ID beside your face.";
  }
  return "Capture a clear image of the authority document.";
}

export default function MobileCapturePage() {
  const params = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [session, setSession] = useState<PublicCaptureSessionResponse["item"] | null>(null);
  const [capturedImageDataUrl, setCapturedImageDataUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompleteCaptureResponse | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let disposed = false;

    const stopStream = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };

    const startCamera = async (field: CaptureField) => {
      stopStream();
      const preferredFacingMode = field === "selfie" ? "user" : "environment";

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: preferredFacingMode } },
          audio: false,
        });

        if (disposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch {
        setError("Unable to access camera. Allow camera permission and retry.");
      }
    };

    const loadSession = async () => {
      if (!params.sessionId || !token) {
        setError("Missing or invalid capture link.");
        setLoading(false);
        return;
      }

      try {
        const response = await apiFetch<PublicCaptureSessionResponse>(
          `/mobile-capture-sessions/${params.sessionId}?token=${encodeURIComponent(token)}`,
        );
        if (disposed) {
          return;
        }
        setSession(response.item);
        if (response.item.status === "pending") {
          await startCamera(response.item.field_type);
        } else {
          stopStream();
        }
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : "Unable to load capture session.");
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    };

    void loadSession();

    return () => {
      disposed = true;
      stopStream();
    };
  }, [params.sessionId, token]);

  const captureFrame = () => {
    if (!videoRef.current) {
      setError("Camera preview is not ready.");
      return;
    }

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Unable to capture image.");
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedImageDataUrl(dataUrl);
    setError(null);
  };

  const submitCapture = async () => {
    if (!params.sessionId || !token) {
      setError("Missing capture token.");
      return;
    }
    if (!capturedImageDataUrl) {
      setError("Capture an image first.");
      return;
    }

    try {
      setSubmitting(true);
      const response = await apiFetch<CompleteCaptureResponse>(
        `/mobile-capture-sessions/${params.sessionId}/complete`,
        {
          method: "POST",
          body: {
            token,
            imageDataUrl: capturedImageDataUrl,
            fileName: `${session?.field_type || "capture"}_${Date.now()}.jpg`,
          },
        },
      );
      setResult(response);
      setSession((prev) =>
        prev
          ? {
              ...prev,
              status: "completed",
              captured_at: response.item.captured_at,
            }
          : prev,
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit capture.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card capture-shell page-card page-card-narrow">
      <h1 style={{ marginTop: 0 }}>Mobile Capture</h1>
      {loading && <p className="small">Loading capture session...</p>}
      {!loading && session && (
        <>
          <p className="small" style={{ margin: 0 }}>
            Field: {session.field_type === "authority_document" ? "Authority document" : session.field_type}
          </p>
          <p className="small" style={{ margin: "2px 0 0" }}>
            {getCaptureInstruction(session.field_type)}
          </p>
          <p className="small" style={{ margin: "2px 0 0" }}>
            Expires: {new Date(session.expires_at).toLocaleString()}
          </p>

          {session.status === "pending" && (
            <div className="capture-stage">
              <video autoPlay className="capture-video" muted playsInline ref={videoRef} />
              <div className="capture-actions">
                <button className="primary" onClick={captureFrame} type="button">
                  Capture Photo
                </button>
                <button className="primary" disabled={submitting} onClick={submitCapture} type="button">
                  {submitting ? "Submitting..." : "Submit Capture"}
                </button>
              </div>
              {capturedImageDataUrl && (
                <img alt="Captured preview" className="capture-preview" src={capturedImageDataUrl} />
              )}
            </div>
          )}

          {session.status !== "pending" && (
            <p className="small">Session status: {session.status}. You can return to your desktop browser.</p>
          )}
        </>
      )}

      {result && (
        <p className="small" style={{ marginTop: 12 }}>
          Capture uploaded successfully. File: {result.item.captured_file_name}
        </p>
      )}

      {error && <p className="error">{error}</p>}

      <div className="profile-actions" style={{ marginTop: 14 }}>
        <Link className="ghost-button" href="/profile">
          App
        </Link>
      </div>
    </section>
  );
}
