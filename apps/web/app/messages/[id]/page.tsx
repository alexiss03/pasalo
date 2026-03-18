"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { PAYMENT_BLOCK_MESSAGE, detectPaymentRelatedContent } from "@pasalo/shared";
import { apiFetch } from "../../../lib/api";
import { getAuthToken } from "../../../lib/auth";

type Me = {
  id: string;
  role: "buyer" | "seller" | "agent" | "attorney" | "admin";
};

type Conversation = {
  id: string;
  listing_id: string;
  listing_title: string;
  buyer_user_id: string;
  seller_user_id: string;
  buyer_name: string;
  seller_name: string;
};

type MessageItem = {
  id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

type PaymentIntent = {
  id: string;
  payer_user_id: string;
  payee_user_id: string;
  amount_php: string;
  note: string | null;
  status: "pending" | "paid" | "canceled";
  paid_at: string | null;
  canceled_at: string | null;
  paymongo_checkout_url?: string | null;
  paymongo_last_status?: string | null;
  created_at: string;
};

type Feed<T> = { items: T[] };

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMinutesAgo(value: string): string {
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes <= 0) {
    return "just now";
  }
  return `${minutes} min ago`;
}

function formatPhp(value: string): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatStatusLabel(value: string): string {
  const clean = value.replaceAll("_", " ").trim();
  if (!clean) {
    return value;
  }
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export default function ConversationPage() {
  const params = useParams<{ id: string }>();
  const conversationId = params.id;

  const [me, setMe] = useState<Me | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [paymentIntents, setPaymentIntents] = useState<PaymentIntent[]>([]);
  const [messageBody, setMessageBody] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("1000");
  const [paymentNote, setPaymentNote] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async (withLoading = false) => {
    const token = getAuthToken();
    if (!token) {
      setError("Login first to access messages.");
      setLoading(false);
      return;
    }

    if (withLoading) {
      setLoading(true);
    }

    try {
      const [meData, conversationData, messageData, paymentData] = await Promise.all([
        apiFetch<Me>("/me", { token }),
        apiFetch<Conversation>(`/conversations/${conversationId}`, { token }),
        apiFetch<Feed<MessageItem>>(`/conversations/${conversationId}/messages`, { token }),
        apiFetch<Feed<PaymentIntent>>(`/conversations/${conversationId}/payment-intents`, { token }),
      ]);

      setMe(meData);
      setConversation(conversationData);
      setMessages(messageData.items);
      setPaymentIntents(paymentData.items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load conversation");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(true);
  }, [conversationId]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      return;
    }

    const interval = window.setInterval(() => {
      load(false);
    }, 6000);

    return () => {
      window.clearInterval(interval);
    };
  }, [conversationId]);

  const canCreatePaymentIntent = useMemo(() => {
    if (!me || !conversation) {
      return false;
    }
    if (me.role === "admin") {
      return true;
    }
    return me.id === conversation.seller_user_id;
  }, [me, conversation]);

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const token = getAuthToken();
    if (!token) {
      setError("Login first to send messages.");
      return;
    }

    const text = messageBody.trim();
    if (!text) {
      return;
    }

    if (detectPaymentRelatedContent(text).blocked) {
      setError(PAYMENT_BLOCK_MESSAGE);
      return;
    }

    try {
      await apiFetch(`/conversations/${conversationId}/messages`, {
        method: "POST",
        token,
        body: { body: text },
      });
      setMessageBody("");
      setStatus("Message sent.");
      await load(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send message");
    }
  };

  const createPaymentIntent = async (event: FormEvent) => {
    event.preventDefault();
    const token = getAuthToken();
    if (!token) {
      setError("Login first to create payment requests.");
      return;
    }

    try {
      await apiFetch(`/conversations/${conversationId}/payment-intents`, {
        method: "POST",
        token,
        body: {
          amountPhp: Number(paymentAmount),
          note: paymentNote || undefined,
        },
      });
      setPaymentNote("");
      setStatus("Payment request created with PayMongo checkout.");
      await load(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create payment request");
    }
  };

  const updatePaymentIntent = async (paymentIntentId: string, action: "refresh" | "cancel") => {
    const token = getAuthToken();
    if (!token) {
      setError("Login first to update payment requests.");
      return;
    }

    try {
      await apiFetch(`/payment-intents/${paymentIntentId}`, {
        method: "PATCH",
        token,
        body: { action },
      });
      setStatus(action === "refresh" ? "Payment status refreshed from PayMongo." : "Payment request canceled.");
      await load(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update payment request");
    }
  };

  if (loading) {
    return (
      <section className="card">
        <p className="small" style={{ margin: 0 }}>Loading conversation...</p>
      </section>
    );
  }

  if (error && !conversation) {
    return (
      <section className="grid" style={{ gap: 12 }}>
        <div className="card">
          <p className="error" style={{ margin: 0 }}>{error}</p>
        </div>
        <Link className="nav-chip" href="/messages">
          Messages
        </Link>
      </section>
    );
  }

  return (
    <section className="grid" style={{ gap: 16 }}>
      <div className="card">
        <p style={{ marginTop: 0 }}>
          <Link className="nav-chip" href="/messages">
            Messages
          </Link>
        </p>
        <h1 style={{ marginBottom: 8 }}>{conversation?.listing_title}</h1>
      </div>

      <div className="card chat-thread">
        {!messages.length && <p className="small">No messages yet.</p>}
        {messages.map((message) => {
          const mine = me?.id === message.sender_user_id;
          return (
            <article className={`chat-message ${mine ? "chat-message-mine" : ""}`} key={message.id}>
              <p style={{ margin: 0 }}>{message.body}</p>
              <p className="small" style={{ margin: "6px 0 0" }}>
                {formatDateTime(message.created_at)} • {formatMinutesAgo(message.created_at)}
              </p>
              {mine && (
                <p className="small" style={{ margin: "2px 0 0" }}>
                  {message.read_at ? `Read ${formatMinutesAgo(message.read_at)}` : "Unread"}
                </p>
              )}
            </article>
          );
        })}
      </div>

      <form className="card grid" onSubmit={sendMessage}>
        <label>
          <div className="small" style={{ marginBottom: 6 }}>Message</div>
          <textarea
            value={messageBody}
            onChange={(event) => setMessageBody(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Ask about viewing, unit condition, and transfer process."
            required
          />
        </label>
        <button className="primary" type="submit">Send Message</button>
      </form>

      <div className="card grid" style={{ gap: 10 }}>
        <h2 style={{ marginTop: 0, marginBottom: 0 }}>In-App Payments</h2>

        {canCreatePaymentIntent && (
          <form className="grid" onSubmit={createPaymentIntent}>
            <label>
              <div className="small" style={{ marginBottom: 6 }}>Amount (PHP)</div>
              <input
                type="number"
                min={1}
                step="0.01"
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
                required
              />
            </label>
            <label>
              <div className="small" style={{ marginBottom: 6 }}>Note (optional)</div>
              <input
                type="text"
                maxLength={600}
                value={paymentNote}
                onChange={(event) => setPaymentNote(event.target.value)}
                placeholder="Example: Reservation transfer fee"
              />
            </label>
            <button className="primary" type="submit">Create Payment Request</button>
          </form>
        )}

        {!paymentIntents.length && <p className="small" style={{ margin: 0 }}>No payment requests yet.</p>}

        <div className="grid">
          {paymentIntents.map((intent) => {
            const canPay = intent.status === "pending" && (me?.id === intent.payer_user_id || me?.role === "admin");
            const canCancel =
              intent.status === "pending" &&
              (me?.id === intent.payer_user_id || me?.id === intent.payee_user_id || me?.role === "admin");

            return (
              <article className="card" key={intent.id} style={{ padding: 14 }}>
                <p style={{ margin: 0 }}>
                  <strong>{formatPhp(intent.amount_php)}</strong> • {formatStatusLabel(intent.status)}
                </p>
                {intent.note && (
                  <p className="small" style={{ margin: "6px 0" }}>
                    {intent.note}
                  </p>
                )}
                {intent.paymongo_last_status && (
                  <p className="small" style={{ margin: "4px 0 0" }}>
                    PayMongo: {formatStatusLabel(intent.paymongo_last_status)}
                  </p>
                )}
                <p className="small" style={{ margin: "4px 0 0" }}>
                  Created: {formatDateTime(intent.created_at)}
                </p>
                {intent.paid_at && (
                  <p className="small" style={{ margin: "4px 0 0" }}>
                    Paid: {formatDateTime(intent.paid_at)}
                  </p>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  {canPay && (
                    <>
                      {intent.paymongo_checkout_url && (
                        <button
                          className="primary"
                          onClick={() => window.open(intent.paymongo_checkout_url as string, "_blank", "noopener,noreferrer")}
                          type="button"
                        >
                          Pay with PayMongo
                        </button>
                      )}
                      <button className="ghost" onClick={() => updatePaymentIntent(intent.id, "refresh")} type="button">
                        Refresh Status
                      </button>
                    </>
                  )}
                  {canCancel && (
                    <button className="ghost" onClick={() => updatePaymentIntent(intent.id, "cancel")} type="button">
                      Cancel Request
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {status && <p>{status}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
