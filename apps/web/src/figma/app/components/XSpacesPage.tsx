"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Calendar, List, Plus, Clock, AlertCircle, X, ChevronLeft, ChevronRight, Share2 } from "lucide-react";
import { parseXSpaceId } from "@/lib/parseXSpaceId";
import { supabase } from "@/lib/supabase";
import {
  XSpacesSidebar,
  XSpacesErrorBoundary,
  HomeView,
  ExploreView,
  CalendarView,
  CountdownTimers,
  type MainNav,
  type SpaceForCard,
  type SpaceForCalendar,
  type XSpacesAnalytics,
  type XSpacesReputation,
} from "./xspaces";
import { toLocalYMD, sanitizeErrorMessage, displayTitle } from "./xspaces/utils";
import { Button } from "./ui/button";

type HostProfile = { id: string; display_name: string | null; twitter_username: string | null; profile_image_url: string | null };

type Space = {
  id: string;
  host_profile_id: string;
  title: string;
  x_title?: string | null;
  linkary_title?: string | null;
  description: string | null;
  scheduled_at: string | null;
  duration_mins: number | null;
  status: string;
  created_at: string;
  x_space_id?: string | null;
  x_space_url?: string | null;
  expect_x_link?: boolean;
  host?: HostProfile | null;
};

type Overlap = { id: string; title: string; scheduled_at: string; host_profile_id: string; duration_mins: number | null };

type AudienceOverlap = {
  other_space_id: string;
  other_space_title: string;
  other_host_username: string | null;
  overlap_percent: number;
  overlap_count: number;
  min_audience_size: number;
};

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_EVENTS_PER_DAY = 3;

function getMonthStart(year: number, month: number): Date {
  return new Date(year, month - 1, 1);
}
function getMonthEnd(year: number, month: number): Date {
  return new Date(year, month, 0, 23, 59, 59, 999);
}
function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function getCalendarGrid(year: number, month: number): { date: Date; isCurrentMonth: boolean }[][] {
  const start = getMonthStart(year, month);
  const startDay = start.getDay();
  const monFirst = startDay === 0 ? 6 : startDay - 1;
  const startPad = new Date(start);
  startPad.setDate(startPad.getDate() - monFirst);
  const weeks: { date: Date; isCurrentMonth: boolean }[][] = [];
  let row: { date: Date; isCurrentMonth: boolean }[] = [];
  const cur = new Date(startPad);
  const end = getMonthEnd(year, month);
  const endTime = end.getTime();
  while (cur.getTime() <= endTime || row.length > 0) {
    row.push({ date: new Date(cur), isCurrentMonth: cur.getMonth() === month - 1 });
    if (row.length === 7) {
      weeks.push(row);
      row = [];
    }
    cur.setDate(cur.getDate() + 1);
  }
  if (row.length) {
    while (row.length < 7) {
      row.push({ date: new Date(cur), isCurrentMonth: false });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(row);
  }
  return weeks;
}

export default function XSpacesPage({ setRoute, me }: { setRoute: (r: { name: string }) => void; me: { id: string } | null }) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth() + 1);
  const [showCreate, setShowCreate] = useState(false);
  const [createPrefilledDate, setCreatePrefilledDate] = useState<string | null>(null);
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createScheduledAt, setCreateScheduledAt] = useState("");
  const [createDurationMins, setCreateDurationMins] = useState(60);
  const [overlaps, setOverlaps] = useState<Overlap[]>([]);
  const [overlapLabel, setOverlapLabel] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [detailsSpace, setDetailsSpace] = useState<Space | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [speakerRequesting, setSpeakerRequesting] = useState(false);
  const [speakerRequestMessage, setSpeakerRequestMessage] = useState("");
  const [showAddFromX, setShowAddFromX] = useState(false);
  const [addFromXUrl, setAddFromXUrl] = useState("");
  const [addFromXSaving, setAddFromXSaving] = useState(false);
  const [addFromXError, setAddFromXError] = useState<string | null>(null);
  const [myXSpacesList, setMyXSpacesList] = useState<Array<{ id: string; title: string | null; state: string | null; started_at: string | null; scheduled_start: string | null; url: string }>>([]);
  const [myXSpacesSource, setMyXSpacesSource] = useState<"x" | "linkary" | null>(null);
  const [myXSpacesLoading, setMyXSpacesLoading] = useState(false);
  const [myXSpacesError, setMyXSpacesError] = useState<string | null>(null);
  const [audienceOverlapsBySpaceId, setAudienceOverlapsBySpaceId] = useState<Record<string, AudienceOverlap[]>>({});
  const [overlapsError, setOverlapsError] = useState<boolean>(false);
  const [addFromXSuccess, setAddFromXSuccess] = useState<{ participants_count: number; overlaps: AudienceOverlap[] } | null>(null);
  const [createCohosts, setCreateCohosts] = useState("");
  const [createXSpaceUrl, setCreateXSpaceUrl] = useState("");
  const [overlapsLoading, setOverlapsLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pastSpaces, setPastSpaces] = useState<Space[]>([]);
  const [pastStatsBySpaceId, setPastStatsBySpaceId] = useState<Record<string, { listeners_total?: number; peak_listeners?: number; duration_seconds?: number }>>({});
  const [pastLoading, setPastLoading] = useState(false);
  const [rsvpStatus, setRsvpStatus] = useState<Record<string, "interested" | "going">>({});
  const [createOnX, setCreateOnX] = useState(true);
  const [createJustDoneSpaceId, setCreateJustDoneSpaceId] = useState<string | null>(null);
  const [detectingSpace, setDetectingSpace] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [xConnected, setXConnected] = useState<boolean | null>(null);
  const [spaceRsvps, setSpaceRsvps] = useState<{ total: number; going_count: number; interested_count: number; attendees?: Array<{ profile_id: string; status: string; username?: string | null }> } | null>(null);
  const [detectCandidates, setDetectCandidates] = useState<Array<{ id: string; title: string | null; state: string | null; created_at: string | null; scheduled_start: string | null; score: number }>>([]);
  const [detectCandidatesSource, setDetectCandidatesSource] = useState<"x" | "linkary" | null>(null);
  type SpeakerRequestRow = {
    id: string;
    requester_profile_id: string;
    status: string;
    pitch: string | null;
    topic: string | null;
    message: string | null;
    created_at: string;
    updated_at: string | null;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
  const [spaceSpeakerRequests, setSpaceSpeakerRequests] = useState<SpeakerRequestRow[]>([]);
  const [spaceSpeakerApprovedCount, setSpaceSpeakerApprovedCount] = useState<number>(0);
  const [resolvingRequestId, setResolvingRequestId] = useState<string | null>(null);
  const [speakerRequestTopic, setSpeakerRequestTopic] = useState("");
  const [speakerRequestPitch, setSpeakerRequestPitch] = useState("");
  const [withdrawingRequestId, setWithdrawingRequestId] = useState<string | null>(null);
  const [speakerResolveError, setSpeakerResolveError] = useState<string | null>(null);
  type SponsorProposalRow = {
    id: string;
    space_id: string;
    project_profile_id: string;
    offer_amount: number;
    currency: string;
    sponsorship_type: string;
    message: string | null;
    requested_deliverables: string | null;
    status: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
    created_at: string;
  };
  const [spaceSponsorProposals, setSpaceSponsorProposals] = useState<SponsorProposalRow[]>([]);
  const [sponsorProposalSubmitting, setSponsorProposalSubmitting] = useState(false);
  const [sponsorProposalError, setSponsorProposalError] = useState<string | null>(null);
  const [sponsorApplyOffer, setSponsorApplyOffer] = useState("");
  const [sponsorApplyCurrency, setSponsorApplyCurrency] = useState("USD");
  const [sponsorApplyType, setSponsorApplyType] = useState("custom");
  const [sponsorApplyMessage, setSponsorApplyMessage] = useState("");
  const [sponsorApplyDeliverables, setSponsorApplyDeliverables] = useState("");
  const [acceptPayoutProposalId, setAcceptPayoutProposalId] = useState<string | null>(null);
  const [acceptPayoutMethod, setAcceptPayoutMethod] = useState<"saved_wallet" | "one_time_wallet" | "linkary_wallet">("one_time_wallet");
  const [acceptPayoutAddress, setAcceptPayoutAddress] = useState("");
  const [acceptPayoutSaveAsDefault, setAcceptPayoutSaveAsDefault] = useState(false);
  const [acceptPayoutSaving, setAcceptPayoutSaving] = useState(false);
  const [resolvingSponsorId, setResolvingSponsorId] = useState<string | null>(null);
  const [inboxProposals, setInboxProposals] = useState<Array<{ id: string; space_id: string; space_title: string | null; project_display_name: string | null; project_username: string | null; offer_amount: number; currency: string; sponsorship_type: string; status: string; created_at: string }>>([]);
  const [inboxSpaces, setInboxSpaces] = useState<Array<{ id: string; title?: string; x_title?: string | null; linkary_title?: string | null; host_profile_id?: string }>>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  type MyProposalRow = { id: string; space_id: string; space_display_title: string; host_profile_id: string | null; status: string; offer_amount: number; currency: string; sponsorship_type: string; message: string | null; requested_deliverables: string | null; payout_method: string | null; payout_wallet_address: string | null; accepted_at: string | null; created_at: string; updated_at: string; host_display_name: string | null; host_username: string | null };
  const [myProposals, setMyProposals] = useState<MyProposalRow[]>([]);
  const [myProposalsLoading, setMyProposalsLoading] = useState(false);
  const [linkXSpaceUrl, setLinkXSpaceUrl] = useState("");
  const [linkXSpaceSaving, setLinkXSpaceSaving] = useState(false);
  const [showLinkXSpace, setShowLinkXSpace] = useState(false);
  const [showReplaceLinkConfirm, setShowReplaceLinkConfirm] = useState(false);
  const [replaceLinkMode, setReplaceLinkMode] = useState(false);
  const [replaceLinkSpaceId, setReplaceLinkSpaceId] = useState<string | null>(null);
  const [linkXSpaceError, setLinkXSpaceError] = useState<string | null>(null);
  const [hostAndSpeakers, setHostAndSpeakers] = useState<{ host: HostProfile; speakers: HostProfile[] } | null>(null);
  const [connectXError, setConnectXError] = useState<{ type: "not_configured"; missing: string[] } | { type: "generic" } | null>(null);
  const [mainNav, setMainNav] = useState<MainNav>("home");
  const [discoverSpaces, setDiscoverSpaces] = useState<Space[]>([]);
  const [xspacesAnalytics, setXspacesAnalytics] = useState<XSpacesAnalytics | null>(null);
  const [xspacesAnalyticsLoading, setXspacesAnalyticsLoading] = useState(false);
  const [xspacesReputation, setXspacesReputation] = useState<XSpacesReputation | null>(null);
  const [xspacesReputationLoading, setXspacesReputationLoading] = useState(false);

  const detailModalRef = useRef<HTMLDivElement>(null);
  const createModalRef = useRef<HTMLDivElement>(null);
  const addFromXModalRef = useRef<HTMLDivElement>(null);

  const searchParams = useSearchParams();
  const debug = searchParams?.get("debug") === "1";
  const base = typeof window !== "undefined" ? window.location.origin : "";

  const closeDetailModal = useCallback(() => {
    setDetailsSpace(null);
    setShowReplaceLinkConfirm(false);
    setReplaceLinkMode(false);
    setReplaceLinkSpaceId(null);
    setLinkXSpaceError(null);
  }, []);

  const handleOpenEventDetail = useCallback((s: Space | SpaceForCalendar) => {
    const space = s as Space;
    setDetailsSpace(space);
    setEditTitle(space.x_space_id ? (space.linkary_title ?? "") : (space.title ?? ""));
    setSpeakerRequestMessage("");
  }, []);

  useEffect(() => {
    if (!detailsSpace) return;
    const t = requestAnimationFrame(() => {
      const first = detailModalRef.current?.querySelector<HTMLElement>(
        'button, a[href], input:not([type="hidden"])'
      );
      first?.focus();
    });
    return () => cancelAnimationFrame(t);
  }, [detailsSpace]);
  useEffect(() => {
    if (!showCreate) return;
    const t = requestAnimationFrame(() => {
      const first = createModalRef.current?.querySelector<HTMLElement>(
        'button, a[href], input:not([type="hidden"])'
      );
      first?.focus();
    });
    return () => cancelAnimationFrame(t);
  }, [showCreate]);
  useEffect(() => {
    if (!showAddFromX) return;
    const t = requestAnimationFrame(() => {
      const first = addFromXModalRef.current?.querySelector<HTMLElement>(
        'button, a[href], input:not([type="hidden"])'
      );
      first?.focus();
    });
    return () => cancelAnimationFrame(t);
  }, [showAddFromX]);

  function handleModalKeyDown(
    e: React.KeyboardEvent,
    onClose: () => void,
    containerRef: React.RefObject<HTMLDivElement | null>
  ) {
    if (typeof document === "undefined") return;
    if (e.key === "Escape") {
      if (e.nativeEvent?.isComposing) return;
      const el = e.target as HTMLElement;
      if (el?.tagName === "TEXTAREA") return;
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !containerRef.current) return;
    const focusable = containerRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const list = Array.from(focusable);
    if (list.length === 0) return;
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  }
  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? "";
  }, []);

  const loadSpaces = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const token = await getToken();
      const params = new URLSearchParams();
      if (token) params.set("mine", "1");
      else params.set("upcoming", "1");
      const res = await fetch(`${base}/api/spaces?${params}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal });
      if (signal?.aborted) return;
      const data = await res.json().catch(() => ({}));
      if (signal?.aborted) return;
      setSpaces(Array.isArray(data.spaces) ? data.spaces : []);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [base, getToken]);

  const loadDiscover = useCallback(async (signal?: AbortSignal) => {
    const token = await getToken();
    const params = new URLSearchParams({ upcoming: "1" });
    const res = await fetch(`${base}/api/spaces?${params}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal });
    if (signal?.aborted) return [];
    const data = await res.json().catch(() => ({}));
    return Array.isArray(data.spaces) ? data.spaces : [];
  }, [base, getToken]);

  const loadPast = useCallback(async () => {
    setPastLoading(true);
    const res = await fetch(`${base}/api/xspaces/past`);
    const data = await res.json().catch(() => ({}));
    setPastSpaces(data.spaces ?? []);
    setPastStatsBySpaceId(data.statsBySpaceId ?? {});
    setPastLoading(false);
  }, [base]);

  const loadSpacesForMonth = useCallback(async (year: number, month: number, signal?: AbortSignal) => {
    setLoading(true);
    try {
      const token = await getToken();
      const from = toYMD(getMonthStart(year, month));
      const to = toYMD(getMonthEnd(year, month));
      const params = new URLSearchParams({ from, to, scope: "public" });
      if (token) params.set("mine", "1");
      const res = await fetch(`${base}/api/spaces?${params}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal });
      if (signal?.aborted) return;
      const data = await res.json().catch(() => ({}));
      if (signal?.aborted) return;
      setSpaces(Array.isArray(data.spaces) ? data.spaces : []);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [base, getToken]);

  const spacesByDay = useMemo(() => {
    const map = new Map<string, Space[]>();
    for (const s of spaces) {
      if (!s.scheduled_at || s.status === "cancelled") continue;
      const day = toLocalYMD(new Date(s.scheduled_at));
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(s);
    }
    for (const arr of map.values()) arr.sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));
    return map;
  }, [spaces]);

  useEffect(() => {
    if (mainNav !== "home") return;
    const ac = new AbortController();
    loadSpaces(ac.signal);
    return () => ac.abort();
  }, [mainNav, loadSpaces]);

  useEffect(() => {
    if (mainNav !== "calendar") return;
    const ac = new AbortController();
    loadSpacesForMonth(calendarYear, calendarMonth, ac.signal);
    return () => ac.abort();
  }, [mainNav, calendarYear, calendarMonth, loadSpacesForMonth]);

  useEffect(() => {
    if (mainNav !== "explore") return;
    const ac = new AbortController();
    loadDiscover(ac.signal).then((data) => {
      if (!ac.signal.aborted) setDiscoverSpaces(data);
    });
    return () => ac.abort();
  }, [mainNav, loadDiscover]);

  useEffect(() => {
    if (mainNav !== "inbox" || !me?.id) return;
    setInboxLoading(true);
    getToken().then((token) => {
      fetch(`${base}/api/xspaces/inbox`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        .then((res) => res.json().catch(() => ({})))
        .then((data) => {
          setInboxProposals(Array.isArray(data?.proposals) ? data.proposals : []);
          setInboxSpaces(Array.isArray(data?.spaces) ? data.spaces : []);
        })
        .finally(() => setInboxLoading(false));
    });
  }, [mainNav, me?.id, base, getToken]);

  useEffect(() => {
    if (mainNav !== "my-proposals" || !me?.id) return;
    const ac = new AbortController();
    setMyProposalsLoading(true);
    getToken().then(async (token) => {
      if (!token) { setMyProposalsLoading(false); return; }
      try {
        const res = await fetch(`${base}/api/xspaces/my-proposals`, { headers: { Authorization: `Bearer ${token}` }, signal: ac.signal });
        const data = await res.json().catch(() => ({}));
        if (ac.signal.aborted) return;
        setMyProposals(Array.isArray(data?.proposals) ? data.proposals : []);
      } catch (e) {
        if ((e as { name?: string }).name !== "AbortError") setMyProposals([]);
      } finally {
        if (!ac.signal.aborted) setMyProposalsLoading(false);
      }
    });
    return () => ac.abort();
  }, [mainNav, me?.id, base, getToken]);

  useEffect(() => {
    if (mainNav !== "home" || !me?.id) return;
    const ac = new AbortController();
    setXspacesAnalyticsLoading(true);
    getToken().then(async (token) => {
      if (!token) { setXspacesAnalyticsLoading(false); return; }
      try {
        const res = await fetch(`${base}/api/xspaces/analytics`, { headers: { Authorization: `Bearer ${token}` }, signal: ac.signal });
        const data = await res.json().catch(() => ({}));
        if (ac.signal.aborted) return;
        if (res.ok && data && typeof data.host === "object" && typeof data.speaker === "object" && typeof data.project === "object") {
          setXspacesAnalytics(data as XSpacesAnalytics);
        } else {
          setXspacesAnalytics(null);
        }
      } catch (e) {
        if ((e as { name?: string }).name !== "AbortError") setXspacesAnalytics(null);
      } finally {
        if (!ac.signal.aborted) setXspacesAnalyticsLoading(false);
      }
    });
    return () => ac.abort();
  }, [mainNav, me?.id, base, getToken]);

  useEffect(() => {
    if (mainNav !== "home" || !me?.id) return;
    const ac = new AbortController();
    setXspacesReputationLoading(true);
    getToken().then(async (token) => {
      if (!token) { setXspacesReputationLoading(false); return; }
      try {
        const res = await fetch(`${base}/api/xspaces/reputation`, { headers: { Authorization: `Bearer ${token}` }, signal: ac.signal });
        const data = await res.json().catch(() => ({}));
        if (ac.signal.aborted) return;
        if (res.ok && data && typeof data.speaker === "object" && typeof data.sponsor === "object" && typeof data.host === "object") {
          setXspacesReputation(data as XSpacesReputation);
        } else {
          setXspacesReputation(null);
        }
      } catch (e) {
        if ((e as { name?: string }).name !== "AbortError") setXspacesReputation(null);
      } finally {
        if (!ac.signal.aborted) setXspacesReputationLoading(false);
      }
    });
    return () => ac.abort();
  }, [mainNav, me?.id, base, getToken]);

  const fetchXMe = useCallback(async () => {
    if (!me?.id || !base) return;
    const t = await getToken();
    if (!t) return;
    const res = await fetch(`${base}/api/x/me`, { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    setXConnected(d?.connected === true);
  }, [me?.id, base, getToken]);

  useEffect(() => {
    fetchXMe();
  }, [fetchXMe]);

  const handleConnectX = useCallback(async () => {
    setConnectXError(null);
    const token = await getToken();
    const res = await fetch(`${base}/api/x/connect`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => ({}));
    if (res.ok && typeof data?.url === "string") {
      window.location.href = data.url;
      return;
    }
    if (res.status === 503 && data?.code === "X_OAUTH_NOT_CONFIGURED") {
      const missing = Array.isArray(data.missing) ? data.missing.filter((k): k is string => typeof k === "string") : [];
      setConnectXError({ type: "not_configured", missing });
      return;
    }
    setConnectXError({ type: "generic" });
  }, [base, getToken]);

  const xConnectedFromRedirect = searchParams?.get("x_connected") === "1";
  const xOauthError = searchParams?.get("x_oauth_error") === "1";
  const [showOAuthErrorBanner, setShowOAuthErrorBanner] = useState(false);
  useEffect(() => {
    if (!xConnectedFromRedirect || !me?.id || !base) return;
    fetchXMe();
    const url = new URL(typeof window !== "undefined" ? window.location.href : "");
    url.searchParams.delete("x_connected");
    url.searchParams.delete("x_oauth_error");
    const replace = url.pathname + url.search;
    if (typeof window !== "undefined" && (window.history?.replaceState)) window.history.replaceState(null, "", replace);
  }, [xConnectedFromRedirect, me?.id, base, fetchXMe]);

  useEffect(() => {
    if (xOauthError) {
      setShowOAuthErrorBanner(true);
      if (typeof window !== "undefined" && window.history?.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.delete("x_oauth_error");
        window.history.replaceState(null, "", url.pathname + url.search);
      }
    }
  }, [xOauthError]);

  const loadMyXSpaces = useCallback(async () => {
    const token = await getToken();
    setMyXSpacesError(null);
    const res = await fetch(`${base}/api/xspaces/my-x-spaces`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMyXSpacesList([]);
      setMyXSpacesSource(null);
      if (res.status === 401 && (data.code === "AUTH_INVALID" || data.error === "Invalid session" || data.error === "Unauthorized")) {
        setMyXSpacesError("Your session may have expired. Please sign in again.");
      } else if (res.status === 402 && data.code === "X_CREDITS_DEPLETED") {
        setMyXSpacesError(data.error ?? "X API credits for this app are depleted. Try again later.");
      } else if (res.status === 403 && (data.code === "X_RECONNECT_NEEDED" || data.code === "X_NOT_CONNECTED" || data.code === "X_USER_ID_MISSING" || data.code === "X_ACCESS_TOKEN_MISSING")) {
        setMyXSpacesError(data.error ?? "Connect or reconnect X in Settings or XSpaces to see your Spaces.");
      } else if (res.status === 429 && (data.code === "X_RATE_LIMITED" || data.code === "RATE_LIMITED")) {
        setMyXSpacesError(data.error ?? "Rate limit reached. Try again later.");
      } else {
        setMyXSpacesError(data.error ?? "X or our service is temporarily unavailable. Try again later.");
      }
      return;
    }
    setMyXSpacesError(null);
    setMyXSpacesSource(data.spaces_source === "linkary" ? "linkary" : "x");
    setMyXSpacesList(Array.isArray(data.spaces) ? data.spaces : []);
  }, [base, getToken]);

  useEffect(() => {
    if (showAddFromX && xConnected === true) {
      setMyXSpacesLoading(true);
      loadMyXSpaces().finally(() => setMyXSpacesLoading(false));
    } else if (!showAddFromX) {
      setMyXSpacesList([]);
      setMyXSpacesSource(null);
      setMyXSpacesError(null);
    }
  }, [showAddFromX, xConnected, loadMyXSpaces]);

  const loadDetailRsvps = useCallback(async (spaceId: string) => {
    const token = await getToken();
    const res = await fetch(`${base}/api/xspaces/${spaceId}/rsvps`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const data = await res.json().catch(() => ({}));
    setSpaceRsvps(data?.total != null ? { total: data.total, going_count: data.going_count ?? 0, interested_count: data.interested_count ?? 0, attendees: data.attendees } : null);
  }, [base, getToken]);

  const loadDetailSpeakerRequests = useCallback(async (spaceId: string) => {
    const token = await getToken();
    const res = await fetch(`${base}/api/xspaces/${spaceId}/speaker-requests`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const data = await res.json().catch(() => ({}));
    setSpaceSpeakerRequests(Array.isArray(data?.requests) ? data.requests : []);
    setSpaceSpeakerApprovedCount(typeof data?.approved_count === "number" ? data.approved_count : 0);
  }, [base, getToken]);

  const loadHostAndSpeakers = useCallback(async (spaceId: string) => {
    const token = await getToken();
    const res = await fetch(`${base}/api/xspaces/${spaceId}/host-and-speakers`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const data = await res.json().catch(() => ({}));
    if (data.host != null) setHostAndSpeakers({ host: data.host, speakers: Array.isArray(data.speakers) ? data.speakers : [] });
    else setHostAndSpeakers(null);
  }, [base, getToken]);

  const loadDetailSponsorProposals = useCallback(async (spaceId: string) => {
    const token = await getToken();
    const res = await fetch(`${base}/api/spaces/${spaceId}/sponsor-proposals`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const data = await res.json().catch(() => ({}));
    setSpaceSponsorProposals(Array.isArray(data?.proposals) ? data.proposals : []);
  }, [base, getToken]);

  useEffect(() => {
    if (!detailsSpace) {
      setEditTitle("");
      setSpaceRsvps(null);
      setSpaceSpeakerRequests([]);
      setSpaceSpeakerApprovedCount(0);
      setSpaceSponsorProposals([]);
      setSponsorProposalError(null);
      setAcceptPayoutProposalId(null);
      setAcceptPayoutAddress("");
      setSpeakerRequestTopic("");
      setSpeakerRequestPitch("");
      setHostAndSpeakers(null);
      setShowLinkXSpace(false);
      setShowReplaceLinkConfirm(false);
      setReplaceLinkMode(false);
      setReplaceLinkSpaceId(null);
      setLinkXSpaceError(null);
      setSpeakerResolveError(null);
      return;
    }
    setSpeakerResolveError(null);
    setShowLinkXSpace(false);
    setShowReplaceLinkConfirm(false);
    setReplaceLinkMode(false);
    setReplaceLinkSpaceId(null);
    setLinkXSpaceError(null);
    loadDetailRsvps(detailsSpace.id);
    loadHostAndSpeakers(detailsSpace.id);
    if (me?.id) {
      loadDetailSpeakerRequests(detailsSpace.id);
      loadDetailSponsorProposals(detailsSpace.id);
    }
  }, [detailsSpace?.id, detailsSpace?.host_profile_id, me?.id, loadDetailRsvps, loadDetailSpeakerRequests, loadDetailSponsorProposals, loadHostAndSpeakers]);

  const loadAudienceOverlaps = useCallback(
    async (spaceIds: string[]) => {
      if (!me?.id || spaceIds.length === 0) return;
      const token = await getToken();
      if (!token) return;
      setOverlapsError(false);
      setOverlapsLoading(true);
      const next: Record<string, AudienceOverlap[]> = {};
      let hadError = false;
      for (const id of spaceIds) {
        try {
          const res = await fetch(`${base}/api/spaces/audience-overlaps?space_id=${encodeURIComponent(id)}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json().catch(() => ({}));
          next[id] = Array.isArray(data.overlaps) ? data.overlaps : [];
          if (!res.ok) hadError = true;
        } catch {
          hadError = true;
        }
      }
      if (hadError) setOverlapsError(true);
      setAudienceOverlapsBySpaceId((prev) => ({ ...prev, ...next }));
      setOverlapsLoading(false);
    },
    [base, getToken, me?.id]
  );

  useEffect(() => {
    const withX = spaces.filter((s) => s.x_space_id && me?.id && s.host_profile_id === me.id).map((s) => s.id);
    if (withX.length > 0) loadAudienceOverlaps(withX);
    else setOverlapsLoading(false);
  }, [spaces, me?.id, loadAudienceOverlaps]);

  const [overlapsSkeletonShown, setOverlapsSkeletonShown] = useState(false);
  useEffect(() => {
    if (!overlapsLoading) return;
    const t = setTimeout(() => setOverlapsSkeletonShown(true), 1000);
    return () => clearTimeout(t);
  }, [overlapsLoading]);
  useEffect(() => {
    if (!overlapsLoading) setOverlapsSkeletonShown(false);
  }, [overlapsLoading]);

  const checkOverlaps = useCallback(async (scheduledAt: string, durationMins: number, excludeSpaceId?: string) => {
    if (!scheduledAt) return;
    const params = new URLSearchParams({ scheduled_at: scheduledAt, duration_mins: String(durationMins) });
    if (excludeSpaceId) params.set("exclude_space_id", excludeSpaceId);
    const res = await fetch(`${base}/api/spaces/overlaps?${params}`);
    const data = await res.json().catch(() => ({}));
    setOverlaps(data.overlaps ?? []);
    setOverlapLabel(data.overlaps?.length ? `Conflict: ${data.overlaps.length} space(s) within ±60 min` : null);
  }, [base]);

  useEffect(() => {
    if (showCreate && createScheduledAt) {
      checkOverlaps(createScheduledAt, createDurationMins);
    } else {
      setOverlaps([]);
      setOverlapLabel(null);
    }
  }, [showCreate, createScheduledAt, createDurationMins, checkOverlaps]);

  const handleCreate = async () => {
    if (!createTitle.trim() || !me?.id) return;
    if (!createScheduledAt.trim()) return;
    setSaving(true);
    const token = await getToken();
    const scheduledAtIso = new Date(createScheduledAt).toISOString();
    const res = await fetch(`${base}/api/spaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: createTitle.trim(),
        description: createDescription.trim() || null,
        scheduled_at: scheduledAtIso,
        duration_mins: createDurationMins,
        status: "planned",
        cohosts: createCohosts.trim() || undefined,
        x_space_url: createXSpaceUrl.trim() || undefined,
        expect_x_link: createOnX,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (data.id) {
      if (createOnX) {
        setCreateJustDoneSpaceId(data.id);
        setDetectError(null);
      } else {
        setShowCreate(false);
        setCreateTitle("");
        setCreateDescription("");
        setCreateScheduledAt("");
        setCreatePrefilledDate(null);
        setCreateDurationMins(60);
        setCreateCohosts("");
        setCreateXSpaceUrl("");
        setCreateError(null);
      }
      if (mainNav === "calendar") loadSpacesForMonth(calendarYear, calendarMonth);
      else loadSpaces();
    } else {
      setCreateError(sanitizeErrorMessage(data.message ?? data.error ?? "Create failed"));
    }
  };

  const isHost = (s: Space) => me?.id && s.host_profile_id === me.id;
  const mySpaces = spaces.filter((s) => isHost(s));
  const upcoming = spaces
    .filter(
      (s) =>
        s.status === "planned" ||
        (s.scheduled_at && new Date(s.scheduled_at) >= new Date())
    )
    .sort((a, b) => (a.scheduled_at ?? "9999").localeCompare(b.scheduled_at ?? "9999"));
  const overlapAlertsList = useMemo(() => {
    const list: { space: Space; overlap: AudienceOverlap }[] = [];
    mySpaces.forEach((s) => {
      (audienceOverlapsBySpaceId[s.id] ?? []).forEach((o) => {
        if (o.overlap_percent >= 5) list.push({ space: s, overlap: o });
      });
    });
    list.sort((a, b) => b.overlap.overlap_percent - a.overlap.overlap_percent);
    return list;
  }, [mySpaces, audienceOverlapsBySpaceId]);

  const handleSaveEdit = async () => {
    if (!detailsSpace || !isHost(detailsSpace)) return;
    setEditSaving(true);
    const token = await getToken();
    const res = await fetch(`${base}/api/spaces/${detailsSpace.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: editTitle.trim() }),
    });
    setEditSaving(false);
    if (res.ok) {
      setDetailsSpace(null);
      if (mainNav === "calendar") loadSpacesForMonth(calendarYear, calendarMonth);
      else loadSpaces();
    }
  };
  const handleCancelSpace = async () => {
    if (!detailsSpace || !isHost(detailsSpace)) return;
    setEditSaving(true);
    const token = await getToken();
    const res = await fetch(`${base}/api/spaces/${detailsSpace.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: "cancelled" }),
    });
    setEditSaving(false);
    if (res.ok) {
      setDetailsSpace(null);
      if (mainNav === "calendar") loadSpacesForMonth(calendarYear, calendarMonth);
      else loadSpaces();
    }
  };
  const clearCreateAndRefresh = useCallback(() => {
    setCreateJustDoneSpaceId(null);
    setShowCreate(false);
    setCreateTitle("");
    setCreateDescription("");
    setCreateScheduledAt("");
    setCreatePrefilledDate(null);
    setCreateDurationMins(60);
    setCreateCohosts("");
    setCreateXSpaceUrl("");
    setCreateError(null);
    setDetectCandidates([]);
    setDetectCandidatesSource(null);
    setDetectError(null);
    if (mainNav === "calendar") loadSpacesForMonth(calendarYear, calendarMonth);
    else loadSpaces();
  }, [mainNav, calendarYear, calendarMonth, loadSpaces, loadSpacesForMonth]);

  const updateSpaceLinkState = useCallback((spaceId: string, x_space_id: string, x_space_url: string) => {
    setSpaces((prev) => prev.map((s) => (s.id === spaceId ? { ...s, x_space_id, x_space_url } : s)));
    setDetailsSpace((prev) => (prev?.id === spaceId ? { ...prev, x_space_id, x_space_url } : prev));
  }, []);

  const [detectLinkedPolling, setDetectLinkedPolling] = useState(false);
  const pollIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const spaceId = createJustDoneSpaceId;
    if (!spaceId || !detectLinkedPolling) return;
    const POLL_INTERVAL_MS = 10_000;
    const POLL_DURATION_MS = 60_000;
    const startedAt = Date.now();
    const poll = async (): Promise<boolean> => {
      try {
        const res = await fetch(`${base}/api/xspaces/${spaceId}/link-status`);
        const data = await res.json().catch(() => ({}));
        if (data.linked && data.x_space_id && data.x_space_url) {
          updateSpaceLinkState(spaceId, data.x_space_id, data.x_space_url);
          setDetectLinkedPolling(false);
          setDetectError(null);
          setDetectCandidates([]);
          setDetectCandidatesSource(null);
          clearCreateAndRefresh();
          return true;
        }
      } catch {
        /* ignore */
      }
      return false;
    };
    const tick = () => {
      if (Date.now() - startedAt >= POLL_DURATION_MS) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
        setDetectLinkedPolling(false);
        setDetectError("No match found — paste the X Space link below.");
        return;
      }
      poll().then((done) => {
        if (done && pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      });
    };
    poll().then((done) => {
      if (done) return;
      pollIntervalRef.current = setInterval(tick, POLL_INTERVAL_MS);
    });
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    };
  }, [base, createJustDoneSpaceId, detectLinkedPolling, updateSpaceLinkState, clearCreateAndRefresh]);

  const handleDetectMySpace = useCallback(async () => {
    const spaceId = createJustDoneSpaceId;
    if (!spaceId) return;
    setDetectingSpace(true);
    setDetectError(null);
    setDetectCandidates([]);
    setDetectCandidatesSource(null);
    setDetectLinkedPolling(true);
    const token = await getToken();
    const res = await fetch(`${base}/api/xspaces/detect-my-space`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ space_id: spaceId }),
    });
    const data = await res.json().catch(() => ({}));
    setDetectingSpace(false);
    if (res.status === 429) {
      setDetectLinkedPolling(false);
      setDetectError(sanitizeErrorMessage(data.error ?? "Too many attempts. Wait a minute and try again."));
      return;
    }
    if (res.status === 401 && (data.code === "AUTH_INVALID" || data.error === "Invalid session" || data.error === "Unauthorized")) {
      setDetectLinkedPolling(false);
      setDetectError("Your session may have expired. Please sign in again.");
      return;
    }
    if (res.status === 403 && (data.code === "X_RECONNECT_NEEDED" || data.code === "X_NOT_CONNECTED" || data.code === "X_USER_ID_MISSING")) {
      setDetectLinkedPolling(false);
      setDetectError(data.error ?? "Connect or reconnect X in Settings or XSpaces to detect your Space.");
      return;
    }
    if ((res.status === 402 || data.code === "X_CREDITS_DEPLETED")) {
      setDetectLinkedPolling(false);
      setDetectError(data.error ?? "X API credits for this app are depleted. Paste the Space link below.");
      return;
    }
    if (res.status === 409 && data.code === "ALREADY_LINKED") {
      setDetectLinkedPolling(false);
      setDetectError("This space is already linked. Use Replace in the space details to change it.");
      return;
    }
    if (data.found && data.require_selection && Array.isArray(data.candidates)) {
      setDetectCandidates(data.candidates);
      setDetectCandidatesSource((data as { candidates_source?: string }).candidates_source === "linkary" ? "linkary" : "x");
      setDetectError(null);
      return;
    }
    if (data.found && data.linked && data.x_space_id && spaceId) {
      setDetectLinkedPolling(false);
      setDetectCandidates([]);
      setDetectCandidatesSource(null);
      updateSpaceLinkState(spaceId, data.x_space_id, data.x_space_url ?? `https://x.com/i/spaces/${data.x_space_id}`);
      clearCreateAndRefresh();
      return;
    }
    if (data.found === false) {
      setDetectError("No match found — paste the X Space link below.");
      return;
    }
    if (!res.ok) {
      setDetectLinkedPolling(false);
      const isServerError = res.status === 502 || res.status === 503;
      setDetectError(isServerError
        ? "X or our service is temporarily unavailable. Try again in a moment or paste the link below."
        : sanitizeErrorMessage(data.error ?? "Something went wrong. You can retry or paste the link below."));
    }
  }, [base, createJustDoneSpaceId, getToken, clearCreateAndRefresh, updateSpaceLinkState]);

  const handleSelectDetectCandidate = useCallback(async (xSpaceId: string) => {
    const spaceId = createJustDoneSpaceId;
    if (!spaceId) return;
    setDetectingSpace(true);
    setDetectError(null);
    const token = await getToken();
    const res = await fetch(`${base}/api/xspaces/link-space`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ space_id: spaceId, x_space_id: xSpaceId, force: replaceLinkSpaceId === spaceId }),
    });
    const data = await res.json().catch(() => ({}));
    setDetectingSpace(false);
    if (res.ok && data.x_space_id) {
      setReplaceLinkSpaceId(null);
      setDetectCandidates([]);
      setDetectCandidatesSource(null);
      updateSpaceLinkState(spaceId, data.x_space_id, data.x_space_url ?? `https://x.com/i/spaces/${data.x_space_id}`);
      clearCreateAndRefresh();
    } else if (res.status === 409 && data.code === "ALREADY_LINKED") {
      setDetectError("This space is already linked. Use Replace in the space details to change it.");
    } else if (res.status === 409 && data.code === "X_SPACE_ALREADY_CLAIMED") {
      setDetectError(data.error ?? "That X Space is already linked to another Space. Paste your new Space link below.");
    } else {
      setDetectError(sanitizeErrorMessage(data.error ?? "Failed to link. Try paste fallback."));
    }
  }, [base, createJustDoneSpaceId, getToken, clearCreateAndRefresh, updateSpaceLinkState, replaceLinkSpaceId]);

  const handleRequestSpeaker = async () => {
    if (!detailsSpace || !me?.id || isHost(detailsSpace)) return;
    const pitch = speakerRequestPitch.trim().slice(0, 500);
    const topic = speakerRequestTopic.trim().slice(0, 200);
    if (!pitch || !topic) return;
    setSpeakerRequesting(true);
    const token = await getToken();
    const body = { pitch, topic, message: speakerRequestMessage.trim() ? speakerRequestMessage.trim().slice(0, 500) : undefined };
    const res = await fetch(`${base}/api/spaces/${detailsSpace.id}/speaker-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    setSpeakerRequesting(false);
    if (res.ok) {
      setSpeakerRequestTopic("");
      setSpeakerRequestPitch("");
      setSpeakerRequestMessage("");
      loadDetailSpeakerRequests(detailsSpace.id);
    }
  };

  function OverlapText({ o }: { o: AudienceOverlap }) {
    const pct = Number(o.overlap_percent);
    const isHigh = pct >= 5.0;
    const pctDisplay = Number.isFinite(pct) ? pct.toFixed(1) : "0.0";
    return (
      <span className={isHigh ? "text-destructive font-medium" : ""}>
        Audience overlap: {pctDisplay}% ({o.overlap_count} users)
      </span>
    );
  }

  function HostRow({ host, compact }: { host: HostProfile; compact?: boolean }) {
    const name = host.display_name?.trim() || (host.twitter_username ? `@${host.twitter_username}` : "Host");
    const initials = (host.display_name?.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("") || host.twitter_username?.slice(0, 2) || "?").toUpperCase();
    const size = compact ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm";
    return (
      <div className={`flex items-center gap-2 ${compact ? "flex-wrap" : ""}`}>
        {host.profile_image_url ? (
          <img src={host.profile_image_url} alt="" className={`${size} rounded-full object-cover shrink-0`} />
        ) : (
          <span className={`${size} rounded-full bg-muted flex items-center justify-center font-medium text-muted-foreground shrink-0`}>{initials}</span>
        )}
        <div className="min-w-0">
          <span className="text-sm font-medium text-foreground truncate block">{name}</span>
          {host.twitter_username && host.display_name?.trim() && (
            <span className="text-xs text-muted-foreground">@{host.twitter_username}</span>
          )}
        </div>
      </div>
    );
  }

  function SpeakersRow({ speakers, max = 5 }: { speakers: HostProfile[]; max?: number }) {
    const show = speakers.slice(0, max);
    const rest = speakers.length - max;
    const size = "w-8 h-8 text-xs";
    return (
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-xs font-medium text-muted-foreground mr-1">Speakers</span>
        {show.map((p) => {
          const initials = (p.display_name?.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("") || p.twitter_username?.slice(0, 2) || "?").toUpperCase();
          return p.profile_image_url ? (
            <img key={p.id} src={p.profile_image_url} alt="" title={p.display_name ?? p.twitter_username ?? undefined} className={`${size} rounded-full object-cover shrink-0 ring-1 ring-border`} />
          ) : (
            <span key={p.id} title={p.display_name ?? p.twitter_username ?? undefined} className={`${size} rounded-full bg-muted flex items-center justify-center font-medium text-muted-foreground shrink-0 ring-1 ring-border`}>{initials}</span>
          );
        })}
        {rest > 0 && <span className="text-xs text-muted-foreground ml-0.5">+{rest}</span>}
      </div>
    );
  }

  const homeEventListContent = mainNav === "home" ? (
        <div className="space-y-3">
          {overlapsError && (
            <p className="text-sm text-muted-foreground">Overlaps unavailable.</p>
          )}
          {upcoming.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
              <p className="text-muted-foreground mb-4">No upcoming spaces yet.</p>
              {me?.id && (
                <div className="flex flex-wrap justify-center gap-3">
                  <Button onClick={() => { setCreatePrefilledDate(null); setCreateScheduledAt(""); setCreateError(null); setShowCreate(true); }}>Create Space</Button>
                  <Button variant="outline" onClick={() => { setAddFromXUrl(""); setAddFromXError(null); setShowAddFromX(true); }}>Add from X</Button>
                </div>
              )}
              <div className="mt-4">
                <Button variant="outline" onClick={() => setMainNav("explore")}>Explore</Button>
              </div>
            </div>
          ) : (
            upcoming.map((s) => {
              const audienceOverlaps = audienceOverlapsBySpaceId[s.id] ?? [];
              return (
                <div key={s.id} className="p-4 rounded-2xl border border-border bg-card flex flex-col gap-2">
                  <div className="flex items-center gap-4">
                    <Clock className="w-5 h-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{displayTitle(s)}</p>
                      <p className="text-sm text-muted-foreground">
                        {s.scheduled_at ? new Date(s.scheduled_at).toLocaleString() : "—"} {s.duration_mins ? ` · ${s.duration_mins} min` : ""}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground shrink-0">{s.status}</span>
                  </div>
                  {s.host && <div className="pl-9"><HostRow host={s.host} compact /></div>}
                  {isHost(s) && s.expect_x_link && !s.x_space_id && (
                    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                      <p className="text-sm text-muted-foreground">Not linked to X yet</p>
                      <div className="flex flex-wrap gap-2">
                        {xConnected === false && (
                          <Button type="button" variant="outline" size="sm" onClick={handleConnectX} className="rounded-xl">Connect X</Button>
                        )}
                        <Button variant="outline" size="sm" asChild className="rounded-xl">
                          <a href="https://x.com/i/spaces" target="_blank" rel="noopener noreferrer">Open X</a>
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => { setCreateJustDoneSpaceId(s.id); setDetectError(null); setDetectCandidates([]); setDetectCandidatesSource(null); setShowCreate(true); }} disabled={xConnected !== true} className="rounded-xl">Detect my Space</Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => { setDetailsSpace(s); setEditTitle(s.x_space_id ? (s.linkary_title ?? "") : (s.title ?? "")); setSpeakerRequestMessage(""); setShowLinkXSpace(true); }} className="rounded-xl">Paste link</Button>
                      </div>
                    </div>
                  )}
                  {audienceOverlaps.length > 0 && (
                    <div className="flex items-start gap-2 pl-9 text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        {audienceOverlaps.map((o, i) => (
                          <span key={o.other_space_id}>{i > 0 && "; "}@{o.other_host_username ?? "user"}: <OverlapText o={o} /></span>
                        ))}
                      </span>
                    </div>
                  )}
                  <div className="pl-9 flex gap-2">
                    <Button type="button" variant="link" size="sm" onClick={() => { setDetailsSpace(s); setEditTitle(s.x_space_id ? (s.linkary_title ?? "") : (s.title ?? "")); setSpeakerRequestMessage(""); }}>Details</Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : null;

  return (
    <XSpacesErrorBoundary>
    <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 min-h-0" data-testid="xspaces-shell">
      <XSpacesSidebar mainNav={mainNav} onNav={setMainNav} />
      <main className="flex-1 min-w-0 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">X Spaces</h1>
            <p className="mt-1 sm:mt-2 text-sm text-muted-foreground">Create and manage your X Spaces. Connect X once to enable import and auto-detect.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {me?.id && (
              <>
                {xConnected === true ? (
                  <>
                    <span className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-muted text-muted-foreground text-sm font-medium cursor-default">Connected</span>
                    <Button variant="outline" size="sm" onClick={handleConnectX}>Reconnect</Button>
                  </>
                ) : xConnected === false ? (
                  <Button variant="outline" size="sm" onClick={handleConnectX}>Connect X</Button>
                ) : null}
                <Button size="sm" onClick={() => { setCreatePrefilledDate(null); setCreateScheduledAt(""); setCreateError(null); setCreateJustDoneSpaceId(null); setShowCreate(true); }}>
                  <Plus className="w-4 h-4" /> Create Space
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setAddFromXUrl(""); setAddFromXError(null); setAddFromXSuccess(null); setShowAddFromX(true); }}>Add from X</Button>
              </>
            )}
          </div>
        </div>

      {connectXError && (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm flex items-center justify-between gap-2">
          <p className="text-foreground">
            {connectXError.type === "not_configured"
              ? (connectXError.missing.length > 0
                ? `X connection isn't configured. Missing: ${connectXError.missing.join(", ")}.`
                : "X connection is not configured on this environment. Please contact support.")
              : "Could not start X connection. Please try again."}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => setConnectXError(null)} className="shrink-0 rounded-xl">Dismiss</Button>
        </div>
      )}
      {showOAuthErrorBanner && (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm flex items-center justify-between gap-2">
          <p className="text-foreground">X connection failed, please try again.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowOAuthErrorBanner(false)} className="shrink-0 rounded-xl">Dismiss</Button>
        </div>
      )}
      {debug && (
        <div className="rounded-2xl border border-border bg-muted p-4 text-sm">
          <p className="font-medium text-foreground mb-2">Debug (/?debug=1)</p>
          {mySpaces.map((s) => {
            const overlaps = audienceOverlapsBySpaceId[s.id] ?? [];
            return (
              <div key={s.id} className="mb-3 pl-2 border-l-2 border-border">
                <p className="font-medium text-foreground">{displayTitle(s)}</p>
                {!s.x_space_id ? (
                  <p className="text-muted-foreground">Participants not synced</p>
                ) : (
                  <>
                    <p className="text-muted-foreground">x_space_id: {s.x_space_id}</p>
                    {overlaps.length > 0 && (
                      <ul className="mt-1 text-muted-foreground">
                        {overlaps.slice(0, 5).map((o) => (
                          <li key={o.other_space_id}>
                            overlap_count={o.overlap_count}, min_audience_size={o.min_audience_size}, %={Number(o.overlap_percent).toFixed(1)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {addFromXSuccess && (
        <div className="p-4 rounded-2xl border border-border bg-card">
          <p className="font-medium text-foreground mb-1">Space synced from X</p>
          <p className="text-sm text-muted-foreground mb-2">Participants captured: {addFromXSuccess.participants_count}</p>
          {addFromXSuccess.overlaps.length > 0 && (
            <p className="text-sm font-medium text-foreground mt-2">Top overlaps:</p>
          )}
          <ul className="text-sm text-foreground list-disc list-inside mt-1">
            {addFromXSuccess.overlaps.slice(0, 3).map((o, i) => (
              <li key={i}>
                @{o.other_host_username ?? "user"} — <OverlapText o={o} />
              </li>
            ))}
          </ul>
          <Button type="button" variant="link" size="sm" onClick={() => setAddFromXSuccess(null)} className="mt-2">Dismiss</Button>
        </div>
      )}

      {/* View content by mainNav */}
        {mainNav === "home" && (
          <HomeView
            hostedCount={mySpaces.length}
            spokenCount={undefined}
            onAddEvent={() => { setCreatePrefilledDate(null); setCreateScheduledAt(""); setCreateError(null); setCreateJustDoneSpaceId(null); setShowCreate(true); }}
            onNavToExplore={() => setMainNav("explore")}
            eventListContent={loading ? <p className="text-muted-foreground">Loading spaces…</p> : homeEventListContent}
            emptyStateMessage="No upcoming spaces yet."
            showEmptyExploreCta={true}
            analytics={xspacesAnalytics}
            analyticsLoading={xspacesAnalyticsLoading}
            reputation={xspacesReputation}
            reputationLoading={xspacesReputationLoading}
          />
        )}
        {mainNav === "explore" && (
          <ExploreView
            spaces={discoverSpaces as SpaceForCard[]}
            onSpaceClick={handleOpenEventDetail}
            onRequest={handleOpenEventDetail}
          />
        )}
        {mainNav === "calendar" && (
          <CalendarView
            year={calendarYear}
            month={calendarMonth}
            onPrevMonth={() => { if (calendarMonth === 1) { setCalendarYear((y) => y - 1); setCalendarMonth(12); } else setCalendarMonth((m) => m - 1); }}
            onNextMonth={() => { if (calendarMonth === 12) { setCalendarYear((y) => y + 1); setCalendarMonth(1); } else setCalendarMonth((m) => m + 1); }}
            spacesByDay={spacesByDay as Map<string, SpaceForCalendar[]>}
            onDateClick={me?.id ? (ymd) => { setCreatePrefilledDate(ymd); setCreateScheduledAt(ymd + "T12:00"); setShowCreate(true); } : undefined}
            onEventClick={handleOpenEventDetail}
          />
        )}
        {mainNav === "inbox" && (
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-foreground mb-2">Inbox</h2>
            <p className="text-sm text-muted-foreground mb-4">Pending sponsor proposals for your spaces.</p>
            {inboxLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : inboxProposals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sponsor proposals.</p>
            ) : (
              <ul className="space-y-3">
                {inboxProposals.filter((p) => p.status === "pending").map((p) => (
                  <li key={p.id} className="rounded-xl border border-border bg-card p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-foreground">{p.space_title ?? "Space"}</span>
                      <span className="text-xs text-muted-foreground">{p.project_display_name || (p.project_username ? `@${p.project_username}` : "Project")}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{p.offer_amount} {p.currency} · {p.sponsorship_type.replace(/_/g, " ")}</p>
                    <Button type="button" variant="outline" size="sm" className="mt-2 rounded-xl" onClick={() => {
                      const fromInbox = inboxSpaces.find((s) => s.id === p.space_id);
                      const fromList = spaces.find((s) => s.id === p.space_id) ?? mySpaces.find((s) => s.id === p.space_id);
                      const space = fromList ?? (fromInbox && me?.id ? { id: fromInbox.id, title: fromInbox.title ?? fromInbox.linkary_title ?? fromInbox.x_title ?? p.space_title ?? "Space", host_profile_id: me.id, description: null, scheduled_at: null, duration_mins: null, status: "scheduled", created_at: "" } : null);
                      if (space) setDetailsSpace(space as Space);
                    }}>
                      Open space
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {mainNav === "my-proposals" && (
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-foreground mb-2">My sponsorship proposals</h2>
            <p className="text-sm text-muted-foreground mb-4">Proposals you submitted as a sponsor.</p>
            {myProposalsLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : myProposals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sponsorship proposals yet.</p>
            ) : (
              <ul className="space-y-3">
                {myProposals.map((p) => {
                  const spaceFromList = spaces.find((s) => s.id === p.space_id) ?? discoverSpaces.find((s) => s.id === p.space_id);
                  const minimalSpace: Space = spaceFromList ?? {
                    id: p.space_id,
                    host_profile_id: p.host_profile_id ?? "",
                    title: p.space_display_title,
                    description: null,
                    scheduled_at: null,
                    duration_mins: null,
                    status: "scheduled",
                    created_at: p.created_at,
                  };
                  return (
                    <li key={p.id} className="rounded-xl border border-border bg-card p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-foreground">{p.space_display_title}</span>
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground capitalize">{p.status}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{p.offer_amount} {p.currency} · {p.sponsorship_type.replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Submitted {new Date(p.created_at).toLocaleDateString()}</p>
                      {p.status === "accepted" && (
                        <>
                          <p className="text-xs text-muted-foreground mt-1">
                            Payout: {p.payout_method === "linkary_wallet" ? "Linkary wallet" : (p.payout_wallet_address ? `${p.payout_wallet_address.slice(0, 12)}…` : "—")} · Accepted {p.accepted_at ? new Date(p.accepted_at).toLocaleDateString() : ""}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 italic">Payment is arranged off-platform between sponsor and host.</p>
                        </>
                      )}
                      <Button type="button" variant="outline" size="sm" className="mt-2 rounded-xl" onClick={async () => {
                        if (spaceFromList) {
                          setDetailsSpace(spaceFromList as Space);
                          return;
                        }
                        const token = await getToken();
                        if (!token || !base) { setDetailsSpace(minimalSpace); return; }
                        try {
                          const res = await fetch(`${base}/api/spaces/${p.space_id}`, { headers: { Authorization: `Bearer ${token}` } });
                          if (res.ok) {
                            const data = await res.json().catch(() => null);
                            if (data && data.id) setDetailsSpace(data as Space);
                            else setDetailsSpace(minimalSpace);
                          } else setDetailsSpace(minimalSpace);
                        } catch {
                          setDetailsSpace(minimalSpace);
                        }
                      }}>
                        Open space
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

      {showCreate && (
        <>
          <div className="fixed inset-0 bg-foreground/50 backdrop-blur-sm z-40" onClick={() => { setShowCreate(false); setCreatePrefilledDate(null); setCreateError(null); setCreateJustDoneSpaceId(null); setDetectError(null); setDetectCandidates([]); setDetectCandidatesSource(null); }} aria-hidden />
          <div
            ref={createModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-modal-title"
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-2xl border border-border bg-card backdrop-blur-xl p-6 z-50 shadow-xl"
            onKeyDown={(e) => handleModalKeyDown(e, () => { setShowCreate(false); setCreatePrefilledDate(null); setCreateError(null); setCreateJustDoneSpaceId(null); setDetectError(null); setDetectCandidates([]); setDetectCandidatesSource(null); }, createModalRef)}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="create-modal-title" className="text-lg font-semibold text-foreground">Create X Space</h2>
              <Button type="button" variant="ghost" size="icon" onClick={() => { setShowCreate(false); setCreatePrefilledDate(null); setCreateError(null); setCreateJustDoneSpaceId(null); setDetectError(null); setDetectCandidates([]); setDetectCandidatesSource(null); }} className="rounded-lg" aria-label="Close">
                <X className="w-5 h-5" />
              </Button>
            </div>
            {createError && (
              <p className="mb-3 text-sm text-destructive">{createError}</p>
            )}
            {createJustDoneSpaceId ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Space created on Linkary. Now link it to X:</p>
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  {xConnected !== true && (
                    <p className="text-sm text-muted-foreground">Connect X first (button above) to grant access for import and detection.</p>
                  )}
                  <p className="font-medium text-foreground">1. Paste your X Space link (recommended)</p>
                  <p className="text-xs text-muted-foreground">Paste the link for reliable import. Detection may be unavailable when X API credits are limited.</p>
                  <input type="url" value={createXSpaceUrl} onChange={(e) => setCreateXSpaceUrl(e.target.value)} placeholder="https://x.com/i/spaces/..." className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground text-sm" />
                  {createXSpaceUrl.trim() && (
                    <Button type="button" onClick={async () => {
                      if (!parseXSpaceId(createXSpaceUrl.trim())) { setDetectError("Invalid X Space link."); return; }
                      setDetectError(null);
                      const token = await getToken();
                      const res = await fetch(`${base}/api/spaces/sync-from-x`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ url: createXSpaceUrl.trim() }) });
                      const data = await res.json().catch(() => ({}));
                      if (data.space?.id && data.space?.x_space_id) {
                        updateSpaceLinkState(data.space.id, data.space.x_space_id, data.space.x_space_url ?? `https://x.com/i/spaces/${data.space.x_space_id}`);
                        setCreateJustDoneSpaceId(null); setShowCreate(false); setCreateTitle(""); setCreateDescription(""); setCreateScheduledAt(""); setCreatePrefilledDate(null); setCreateDurationMins(60); setCreateCohosts(""); setCreateXSpaceUrl(""); setCreateError(null);
                        if (mainNav === "calendar") loadSpacesForMonth(calendarYear, calendarMonth); else loadSpaces();
                      } else if (res.status === 409 && data.code === "ALREADY_IMPORTED") {
                        setDetectError(sanitizeErrorMessage(data.error ?? "Already imported."));
                      } else if (res.status === 401 && (data.code === "AUTH_INVALID" || data.error === "Invalid session" || data.error === "Unauthorized")) {
                        setDetectError("Your session may have expired. Please sign in again.");
                      } else if (res.status === 429 && (data.code === "X_RATE_LIMITED" || data.code === "RATE_LIMITED")) {
                        setDetectError(data.error ?? "X rate limit reached. Try again later.");
                      } else if ((res.status === 502 || res.status === 503 || res.status === 404) && !data.space) {
                        setDetectError(res.status === 404 && data.code === "SPACE_NOT_FOUND" ? (data.error ?? "Space not found on X.") : (data.error ?? "X or our service is temporarily unavailable. Try again or paste the link below."));
                      } else if (res.status === 403 && (data.code === "X_NOT_CONNECTED" || data.code === "X_NOT_HOST" || data.code === "X_RECONNECT_NEEDED")) {
                        setDetectError(data.error ?? "Connect or reconnect X to link.");
                      } else {
                        setDetectError(sanitizeErrorMessage(data.error ?? data.message ?? "Failed to link."));
                      }
                    }} className="rounded-xl">Link pasted URL</Button>
                  )}
                  <p className="text-xs text-muted-foreground pt-2 border-t border-border">2. Or try automatic detection</p>
                  <Button type="button" variant="outline" onClick={handleDetectMySpace} disabled={detectingSpace || xConnected !== true} className="rounded-xl">
                    {detectingSpace ? "Detecting…" : "Detect my Space"}
                  </Button>
                  {detectingSpace && <p className="text-sm text-muted-foreground">Checking your recent X Spaces…</p>}
                  {!detectingSpace && detectCandidates.length > 0 && (
                    <>
                      {detectCandidatesSource === "linkary" ? (
                        <p className="text-sm text-muted-foreground">From your Linkary spaces (X detection unavailable). Pick the one that matches:</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">Found {detectCandidates.length} candidate{detectCandidates.length !== 1 ? "s" : ""} — pick the right one:</p>
                      )}
                    </>
                  )}
                  {detectCandidates.length > 0 ? (
                    <div className="space-y-2">
                      {detectCandidates.map((c) => (
                        <Button key={c.id} type="button" variant="outline" onClick={() => handleSelectDetectCandidate(c.id)} disabled={detectingSpace} className="w-full justify-start rounded-xl">
                          {c.title || c.id} {c.scheduled_start ? ` · ${new Date(c.scheduled_start).toLocaleString()}` : ""}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                  {detectError && (
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm text-destructive">{detectError}</p>
                      <Button type="button" variant="outline" size="sm" onClick={() => { setDetectError(null); handleDetectMySpace(); }} disabled={detectingSpace || xConnected !== true} className="rounded-xl">
                        Retry
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={createOnX} onChange={(e) => setCreateOnX(e.target.checked)} className="rounded border-border" />
                <span className="text-sm font-medium text-foreground">Create on X (recommended)</span>
              </label>
              {createOnX && xConnected === false && (
                <p className="text-sm text-muted-foreground">Connect X first (button below) to grant X API access for import and auto-detect.</p>
              )}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Title</label>
                <input type="text" value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="Space title" className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Description (optional)</label>
                <textarea value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Scheduled at (required, local time)</label>
                <input type="datetime-local" value={createScheduledAt} onChange={(e) => setCreateScheduledAt(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Duration (mins)</label>
                <input type="number" min={1} value={createDurationMins} onChange={(e) => setCreateDurationMins(parseInt(e.target.value, 10) || 60)} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Cohosts (optional)</label>
                <input type="text" value={createCohosts} onChange={(e) => setCreateCohosts(e.target.value)} placeholder="@user1 @user2" className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
              </div>
              {!createOnX && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">X Space URL (optional)</label>
                <input type="url" value={createXSpaceUrl} onChange={(e) => setCreateXSpaceUrl(e.target.value)} placeholder="https://x.com/i/spaces/..." className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
              </div>
              )}
              {overlapLabel && (
                <div className="flex items-center gap-2 p-2 rounded-xl bg-muted border border-border text-foreground text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {overlapLabel}
                  {overlaps.length > 0 && (
                    <ul className="list-disc list-inside text-xs mt-1">
                      {overlaps.slice(0, 3).map((o) => (
                        <li key={o.id}>{o.title} — {new Date(o.scheduled_at).toLocaleString()}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Overlap: {overlaps.length ? "conflicts detected (±60 min)" : "unavailable (MVP)"}</p>
            </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              {!createJustDoneSpaceId && (
                <>
                  <Button type="button" variant="outline" onClick={() => { setShowCreate(false); setCreatePrefilledDate(null); setCreateJustDoneSpaceId(null); }} className="rounded-xl">Cancel</Button>
                  <Button type="button" onClick={handleCreate} disabled={saving || !createTitle.trim() || !createScheduledAt.trim()} className="rounded-xl">
                    {saving ? "Creating…" : "Create"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {showAddFromX && (
        <>
          <div className="fixed inset-0 bg-foreground/50 backdrop-blur-sm z-40" onClick={() => { setShowAddFromX(false); setAddFromXError(null); }} aria-hidden />
          <div
            ref={addFromXModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-from-x-modal-title"
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-2xl border border-border bg-card p-6 z-50 shadow-xl"
            onKeyDown={(e) => handleModalKeyDown(e, () => { setShowAddFromX(false); setAddFromXError(null); }, addFromXModalRef)}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="add-from-x-modal-title" className="text-lg font-semibold text-foreground">Add Space from X</h2>
              <Button type="button" variant="ghost" size="icon" onClick={() => { setShowAddFromX(false); setAddFromXError(null); }} className="rounded-xl" aria-label="Close">
                <X className="w-5 h-5" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-3">Paste a Space link to import (most reliable). We’ll pull details and support audience overlap when both hosts are registered.</p>
            <input
              type="url"
              value={addFromXUrl}
              onChange={(e) => { setAddFromXUrl(e.target.value); setAddFromXError(null); }}
              placeholder="https://x.com/i/spaces/..."
              disabled={xConnected !== true}
              className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground mb-2 disabled:opacity-50"
            />
            {xConnected === true && (
              <div className="mb-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Past X Spaces (last 30 days)</p>
                {myXSpacesError ? (
                  <p className="text-sm text-destructive">{myXSpacesError}</p>
                ) : myXSpacesLoading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : myXSpacesList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent Spaces from X.</p>
                ) : (
                  <>
                    {myXSpacesSource === "linkary" && (
                      <p className="text-xs text-muted-foreground mb-2">Showing your Linkary spaces (not a live X list — X API credits or list unavailable).</p>
                    )}
                    <ul className="space-y-2 max-h-48 overflow-y-auto">
                    {myXSpacesList.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border border-border bg-card text-sm">
                        <span className="min-w-0 truncate font-medium text-foreground">{item.title || "Untitled Space"}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={addFromXSaving}
                          className="shrink-0 rounded-xl"
                          onClick={async () => {
                            setAddFromXError(null);
                            setAddFromXSaving(true);
                            const t = await getToken();
                            const r = await fetch(`${base}/api/spaces/sync-from-x`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify({ url: item.url }) });
                            const d = await r.json().catch(() => ({}));
                            setAddFromXSaving(false);
                            if (d.space) {
                              setShowAddFromX(false);
                              setAddFromXSuccess({ participants_count: typeof d.participants_count === "number" ? d.participants_count : 0, overlaps: [] });
                              if (mainNav === "calendar") loadSpacesForMonth(calendarYear, calendarMonth); else loadSpaces();
                            } else if (r.status === 409 && d.code === "ALREADY_IMPORTED") {
                              setAddFromXError(sanitizeErrorMessage(d.error ?? "Already imported."));
                            } else if (r.status === 401 && (d.code === "AUTH_INVALID" || d.error === "Invalid session" || d.error === "Unauthorized")) {
                              setAddFromXError("Your session may have expired. Please sign in again.");
                            } else if (r.status === 429 && (d.code === "X_RATE_LIMITED" || d.code === "RATE_LIMITED")) {
                              setAddFromXError(d.error ?? "X rate limit reached. Try again later.");
                            } else if ((r.status === 502 || r.status === 503 || r.status === 404) && !d.space) {
                              setAddFromXError(r.status === 404 && d.code === "SPACE_NOT_FOUND" ? (d.error ?? "Space not found on X.") : (d.error ?? "X or our service is temporarily unavailable. Try again."));
                            } else if (r.status === 403 && (d.code === "X_NOT_CONNECTED" || d.code === "X_NOT_HOST" || d.code === "X_RECONNECT_NEEDED")) {
                              setAddFromXError(d.error ?? "Connect or reconnect X to import Spaces.");
                            } else {
                              setAddFromXError(sanitizeErrorMessage(d.error ?? d.message ?? "Failed to import."));
                            }
                          }}
                        >
                          Import
                            </Button>
                          </li>
                        ))}
                    </ul>
                  </>
                )}
              </div>
            )}
            {xConnected !== true && (
              <p className="text-sm text-muted-foreground mb-2">Connect X first to grant X API access — then you can import or see your past Spaces.</p>
            )}
            {addFromXError && (
              <p className="text-sm text-destructive mb-2">{addFromXError}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setShowAddFromX(false); setAddFromXError(null); }} className="rounded-xl">Cancel</Button>
              <Button
                type="button"
                disabled={addFromXSaving || xConnected !== true || !addFromXUrl.trim()}
                className="rounded-xl"
                onClick={async () => {
                  if (!parseXSpaceId(addFromXUrl.trim())) { setAddFromXError("Invalid X Space link."); return; }
                  setAddFromXError(null);
                  setAddFromXSaving(true);
                  try {
                    await supabase.auth.refreshSession();
                  } catch {
                    /* non-blocking */
                  }
                  const token = await getToken();
                  if (!token) {
                    setAddFromXSaving(false);
                    setAddFromXError("Please sign in to add a space from X.");
                    return;
                  }
                  const res = await fetch(`${base}/api/spaces/sync-from-x`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ url: addFromXUrl.trim() }),
                  });
                  const data = await res.json().catch(() => ({}));
                  setAddFromXSaving(false);
                  if (data.space) {
                    setShowAddFromX(false);
                    setAddFromXUrl("");
                    const participantsCount = typeof data.participants_count === "number" ? data.participants_count : 0;
                    setAddFromXSuccess({ participants_count: participantsCount, overlaps: [] });
                    if (mainNav === "calendar") loadSpacesForMonth(calendarYear, calendarMonth);
                    else loadSpaces();
                    try {
                      const ovRes = await fetch(`${base}/api/spaces/audience-overlaps?space_id=${encodeURIComponent(data.space.id)}`, {
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      const ovData = await ovRes.json().catch(() => ({}));
                      const arr = Array.isArray(ovData.overlaps) ? ovData.overlaps : [];
                      setAddFromXSuccess((prev) => (prev ? { ...prev, overlaps: arr.slice(0, 3) } : null));
                    } catch {
                      // keep success panel
                    }
                  } else if (res.status === 409 && data.code === "ALREADY_IMPORTED") {
                    setAddFromXError(sanitizeErrorMessage(data.error ?? "Already imported."));
                  } else if (res.status === 401 && (data.code === "AUTH_INVALID" || data.error === "Invalid session" || data.error === "Unauthorized")) {
                    setAddFromXError("Your session may have expired. Please sign in again.");
                  } else if (res.status === 429 && (data.code === "X_RATE_LIMITED" || data.code === "RATE_LIMITED")) {
                    setAddFromXError(data.error ?? "X rate limit reached. Try again later.");
                  } else if ((res.status === 502 || res.status === 503 || res.status === 404) && !data.space) {
                    setAddFromXError(res.status === 404 && data.code === "SPACE_NOT_FOUND" ? (data.error ?? "Space not found on X.") : (data.error ?? "X or our service is temporarily unavailable. Try again or paste the link below."));
                  } else if (res.status === 403 && (data.code === "X_NOT_CONNECTED" || data.code === "X_NOT_HOST" || data.code === "X_RECONNECT_NEEDED")) {
                    setAddFromXError(data.error ?? "Connect or reconnect X to import Spaces.");
                  } else {
                    setAddFromXError(sanitizeErrorMessage(data.error ?? data.message ?? "Failed to sync Space"));
                  }
                }}
              >
                {addFromXSaving ? "Syncing…" : "Add from X"}
              </Button>
            </div>
          </div>
        </>
      )}

      {detailsSpace && (
        <>
          <div className="fixed inset-0 bg-foreground/50 backdrop-blur-sm z-40" onClick={closeDetailModal} aria-hidden />
          <div
            ref={detailModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-detail-modal-title"
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card z-50 shadow-xl flex flex-col"
            onKeyDown={(e) => handleModalKeyDown(e, closeDetailModal, detailModalRef)}
          >
            <div className="flex items-center justify-between gap-4 p-4 border-b border-border shrink-0">
              <h2 id="event-detail-modal-title" className="text-lg font-semibold text-foreground truncate pr-2">Space details</h2>
              <div className="flex items-center gap-2 shrink-0">
                {detailsSpace.x_space_url && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={detailsSpace.x_space_url} target="_blank" rel="noopener noreferrer">Open on X</a>
                  </Button>
                )}
                <Button type="button" variant="ghost" size="icon" className="rounded-xl" title="Add to calendar" aria-label="Add to calendar"><Calendar className="w-4 h-4" /></Button>
                <Button type="button" variant="ghost" size="icon" className="rounded-xl" title="Share" aria-label="Share"><Share2 className="w-4 h-4" /></Button>
                <Button type="button" variant="ghost" size="icon" className="rounded-xl" onClick={closeDetailModal} aria-label="Close">
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr,260px] gap-6 p-6 overflow-y-auto">
              <div className="min-w-0 space-y-2 mb-4">
              {isHost(detailsSpace) ? (
                <>
                  {detailsSpace.x_space_id && (
                    <p className="text-xs text-muted-foreground">Original X title: {detailsSpace.x_title ?? detailsSpace.title}</p>
                  )}
                  <label className="block text-xs font-medium text-muted-foreground mt-1">
                    {detailsSpace.x_space_id ? "Linkary title" : "Title"}
                  </label>
                  <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
                </>
              ) : (
                <>
                  <p className="font-medium text-foreground">{displayTitle(detailsSpace)}</p>
                  {detailsSpace.x_space_id && (
                    <p className="text-xs text-muted-foreground">Original X title: {detailsSpace.x_title ?? detailsSpace.title}</p>
                  )}
                </>
              )}
              <p className="text-sm text-muted-foreground">
                {detailsSpace.scheduled_at ? new Date(detailsSpace.scheduled_at).toLocaleString() : "—"}
                {detailsSpace.duration_mins ? ` · ${detailsSpace.duration_mins} min` : ""}
              </p>
              {(hostAndSpeakers?.host ?? detailsSpace.host) && (
                <div className="py-1">
                  <HostRow host={hostAndSpeakers?.host ?? detailsSpace.host!} />
                </div>
              )}
              {hostAndSpeakers && hostAndSpeakers.speakers.length > 0 && (
                <div className="py-1">
                  <SpeakersRow speakers={hostAndSpeakers.speakers} max={5} />
                </div>
              )}
              {isHost(detailsSpace) && detailsSpace.expect_x_link && !detailsSpace.x_space_id && (
                <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                  <p className="text-sm text-muted-foreground">Not linked to X yet</p>
                  <div className="flex flex-wrap gap-2">
                    {xConnected === false && (
                      <button type="button" onClick={handleConnectX} className="px-3 py-1.5 rounded-lg border border-border bg-secondary text-foreground text-sm font-medium hover:bg-accent">Connect X</button>
                    )}
                    <a href="https://x.com/i/spaces" target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg border border-border bg-secondary text-foreground text-sm font-medium hover:bg-accent">Open X</a>
                    <button type="button" onClick={() => { setDetailsSpace(null); setCreateJustDoneSpaceId(detailsSpace.id); setDetectError(null); setDetectCandidates([]); setDetectCandidatesSource(null); setShowCreate(true); }} disabled={xConnected !== true} className="px-3 py-1.5 rounded-lg border border-border bg-secondary text-foreground text-sm font-medium hover:bg-accent disabled:opacity-50">Detect my Space</button>
                    <button type="button" onClick={() => setShowLinkXSpace(true)} className="px-3 py-1.5 rounded-lg border border-border bg-secondary text-foreground text-sm font-medium hover:bg-accent">Paste link</button>
                  </div>
                </div>
              )}
              {detailsSpace.description && <p className="text-sm text-muted-foreground">{detailsSpace.description}</p>}
              {(audienceOverlapsBySpaceId[detailsSpace.id] ?? []).length > 0 && (
                <div className="flex items-start gap-2 p-2 rounded-lg border border-border bg-card text-sm text-foreground">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    {(audienceOverlapsBySpaceId[detailsSpace.id] ?? []).map((o) => (
                      <p key={o.other_space_id}>
                        @{o.other_host_username ?? "user"} — {o.other_space_title}: <OverlapText o={o} />
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {spaceRsvps && (
                <div className="rounded-xl border border-border bg-card p-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Linkary RSVPs</p>
                  <p className="text-sm text-foreground">{spaceRsvps.going_count} going · {spaceRsvps.interested_count} interested</p>
                  {spaceRsvps.attendees && spaceRsvps.attendees.length > 0 && (
                    <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      {spaceRsvps.attendees.slice(0, 10).map((a) => (
                        <li key={a.profile_id}>@{a.username ?? "user"} — {a.status}</li>
                      ))}
                      {spaceRsvps.attendees.length > 10 && <li>+{spaceRsvps.attendees.length - 10} more</li>}
                    </ul>
                  )}
                </div>
              )}
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs font-medium text-muted-foreground">X reminders</p>
                <p className="text-sm text-muted-foreground">Not available yet</p>
              </div>
              {isHost(detailsSpace) && (
                <>
                  {detailsSpace.status !== "ended" && detailsSpace.status !== "cancelled" && (
                    <Button type="button" variant="outline" size="sm" onClick={async () => {
                      setEditSaving(true);
                      const token = await getToken();
                      const res = await fetch(`${base}/api/spaces/${detailsSpace.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: "ended" }) });
                      setEditSaving(false);
                      if (res.ok) { setDetailsSpace({ ...detailsSpace, status: "ended" }); if (mainNav === "calendar") loadSpacesForMonth(calendarYear, calendarMonth); else loadSpaces(); }
                    }} disabled={editSaving} className="rounded-xl">Mark as ended</Button>
                  )}
                  {detailsSpace.x_space_id ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => { setShowReplaceLinkConfirm(true); setLinkXSpaceError(null); }} className="rounded-xl">Replace linked X Space</Button>
                  ) : (
                    <Button type="button" variant="outline" size="sm" onClick={() => { setShowLinkXSpace(!showLinkXSpace); setLinkXSpaceError(null); setReplaceLinkMode(false); }} className="rounded-xl">Link X Space</Button>
                  )}
                  {showReplaceLinkConfirm && (
                    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                      <p className="text-sm text-muted-foreground">Replace linked X Space? This will disconnect the current X Space from this Linkary Space.</p>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => { setShowReplaceLinkConfirm(false); }} className="rounded-xl">Cancel</Button>
                        <Button type="button" size="sm" onClick={() => { setShowReplaceLinkConfirm(false); setReplaceLinkMode(true); setReplaceLinkSpaceId(detailsSpace.id); setShowLinkXSpace(true); setLinkXSpaceUrl(""); setLinkXSpaceError(null); }} className="rounded-xl">Replace</Button>
                      </div>
                    </div>
                  )}
                  {showLinkXSpace && (
                    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                      {linkXSpaceError && <p className="text-sm text-destructive">{linkXSpaceError}</p>}
                      {replaceLinkMode && (
                        <>
                          <p className="text-xs font-medium text-muted-foreground">Paste replacement URL</p>
                          <input type="url" value={linkXSpaceUrl} onChange={(e) => { setLinkXSpaceUrl(e.target.value); setLinkXSpaceError(null); }} placeholder="https://x.com/i/spaces/..." className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground text-sm" />
                          <Button type="button" size="sm" disabled={linkXSpaceSaving} onClick={async () => {
                            if (!linkXSpaceUrl.trim() || !detailsSpace) return;
                            const xSpaceId = parseXSpaceId(linkXSpaceUrl.trim());
                            if (!xSpaceId) { setLinkXSpaceError("Invalid X Space link."); return; }
                            setLinkXSpaceSaving(true);
                            setLinkXSpaceError(null);
                            const token = await getToken();
                            const res = await fetch(`${base}/api/xspaces/link-space`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ space_id: detailsSpace.id, x_space_id: xSpaceId, force: true }) });
                            const data = await res.json().catch(() => ({}));
                            setLinkXSpaceSaving(false);
                            if (res.ok && data.x_space_id) {
                              const url = data.x_space_url ?? `https://x.com/i/spaces/${data.x_space_id}`;
                              updateSpaceLinkState(detailsSpace.id, data.x_space_id, url);
                              setDetailsSpace({ ...detailsSpace, x_space_id: data.x_space_id, x_space_url: url });
                              setLinkXSpaceUrl(""); setShowLinkXSpace(false); setReplaceLinkMode(false); setReplaceLinkSpaceId(null);
                            } else if (res.status === 409) {
                              setLinkXSpaceError(sanitizeErrorMessage(data.error ?? "This X Space is already linked to another space."));
                            } else {
                              setLinkXSpaceError(sanitizeErrorMessage(data.error ?? "Failed to link."));
                            }
                          }} className="rounded-xl">Save link</Button>
                          <p className="text-xs font-medium text-muted-foreground pt-2 border-t border-border">Or detect replacement</p>
                          <Button type="button" variant="outline" size="sm" onClick={() => { setDetailsSpace(null); setCreateJustDoneSpaceId(detailsSpace.id); setReplaceLinkSpaceId(detailsSpace.id); setDetectError(null); setDetectCandidates([]); setDetectCandidatesSource(null); setShowCreate(true); }} disabled={xConnected !== true} className="rounded-xl">Detect my Space</Button>
                        </>
                      )}
                      {!replaceLinkMode && (
                        <>
                      <input type="url" value={linkXSpaceUrl} onChange={(e) => { setLinkXSpaceUrl(e.target.value); setLinkXSpaceError(null); }} placeholder="https://x.com/i/spaces/..." className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground text-sm" />
                      <Button type="button" size="sm" disabled={linkXSpaceSaving} onClick={async () => {
                        if (!linkXSpaceUrl.trim() || !detailsSpace) return;
                        const xSpaceId = parseXSpaceId(linkXSpaceUrl.trim());
                        if (!xSpaceId) { setLinkXSpaceError("Invalid X Space link."); return; }
                        setLinkXSpaceSaving(true);
                        setLinkXSpaceError(null);
                        const token = await getToken();
                        const res = await fetch(`${base}/api/xspaces/link-space`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ space_id: detailsSpace.id, x_space_id: xSpaceId, force: replaceLinkMode }) });
                        const data = await res.json().catch(() => ({}));
                        setLinkXSpaceSaving(false);
                        if (res.ok && data.x_space_id) {
                          const url = data.x_space_url ?? `https://x.com/i/spaces/${data.x_space_id}`;
                          updateSpaceLinkState(detailsSpace.id, data.x_space_id, url);
                          setDetailsSpace({ ...detailsSpace, x_space_id: data.x_space_id, x_space_url: url });
                          setLinkXSpaceUrl(""); setShowLinkXSpace(false); setReplaceLinkMode(false);
                        } else if (res.status === 409) {
                          setLinkXSpaceError(sanitizeErrorMessage(data.error ?? "Already linked. Use Replace to change."));
                        } else {
                          setLinkXSpaceError(sanitizeErrorMessage(data.error ?? "Failed to link."));
                        }
                      }} className="rounded-xl">Save link</Button>
                        </>
                      )}
                    </div>
                  )}
                  <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Speaker applications · {spaceSpeakerApprovedCount} / 10 approved
                    </p>
                    {spaceSpeakerRequests.filter((sr) => sr.status === "pending").length === 0 && spaceSpeakerRequests.length > 0 && (
                      <p className="text-xs text-muted-foreground">No pending applications.</p>
                    )}
                    {spaceSpeakerRequests.filter((sr) => sr.status === "pending").map((sr) => (
                      <div key={sr.id} className="rounded-lg border border-border bg-card p-3 space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          {sr.avatar_url ? (
                            <img src={sr.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                          ) : (
                            <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
                              {(sr.display_name?.trim().slice(0, 2) || sr.username?.slice(0, 2) || "?").toUpperCase()}
                            </span>
                          )}
                          <div className="min-w-0">
                            <span className="font-medium text-foreground">{sr.display_name?.trim() || (sr.username ? `@${sr.username}` : "User")}</span>
                            {sr.username && sr.display_name?.trim() && <span className="text-muted-foreground ml-1">@{sr.username}</span>}
                          </div>
                        </div>
                        {sr.topic && <p className="text-foreground"><span className="text-muted-foreground">Topic:</span> {sr.topic}</p>}
                        {sr.pitch && <p className="text-foreground"><span className="text-muted-foreground">Pitch:</span> {sr.pitch}</p>}
                        {sr.message && <p className="text-muted-foreground text-xs">{sr.message}</p>}
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            type="button"
                            size="sm"
                            disabled={resolvingRequestId === sr.id || spaceSpeakerApprovedCount >= 10}
                            onClick={async () => {
                              setResolvingRequestId(sr.id);
                              const token = await getToken();
                              const res = await fetch(`${base}/api/xspaces/speaker-request/resolve`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ request_id: sr.id, status: "approved" }) });
                              const data = await res.json().catch(() => ({}));
                              setResolvingRequestId(null);
                              loadDetailSpeakerRequests(detailsSpace.id);
                              loadHostAndSpeakers(detailsSpace.id);
                              if (res.status === 409) setSpeakerResolveError(sanitizeErrorMessage(data.error ?? "Maximum speakers (10) reached."));
                            }}
                            className="rounded-lg text-xs bg-primary/20 text-primary border-primary/30 hover:bg-primary/30"
                          >
                            Approve
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={resolvingRequestId === sr.id}
                            onClick={async () => {
                              setResolvingRequestId(sr.id);
                              const token = await getToken();
                              await fetch(`${base}/api/xspaces/speaker-request/resolve`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ request_id: sr.id, status: "declined" }) });
                              setResolvingRequestId(null);
                              loadDetailSpeakerRequests(detailsSpace.id);
                            }}
                            className="rounded-lg text-xs"
                          >
                            Decline
                          </Button>
                        </div>
                        {spaceSpeakerApprovedCount >= 10 && <p className="text-xs text-muted-foreground">Maximum speakers (10) reached.</p>}
                      </div>
                    ))}
                    {speakerResolveError && <p className="text-xs text-destructive">{speakerResolveError}</p>}
                  </div>
                  <div className="rounded-xl border border-border bg-card p-3 space-y-2 mt-3">
                    <p className="text-xs font-medium text-muted-foreground">Sponsor proposals</p>
                    {spaceSponsorProposals.filter((sp) => sp.status === "pending").length === 0 && spaceSponsorProposals.length > 0 && (
                      <p className="text-xs text-muted-foreground">No pending proposals.</p>
                    )}
                    {spaceSponsorProposals.filter((sp) => sp.status === "pending").map((sp) => (
                      <div key={sp.id} className="rounded-lg border border-border bg-card p-3 space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          {sp.avatar_url ? (
                            <img src={sp.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                          ) : (
                            <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
                              {(sp.display_name?.trim().slice(0, 2) || sp.username?.slice(0, 2) || "?").toUpperCase()}
                            </span>
                          )}
                          <span className="font-medium text-foreground">{sp.display_name?.trim() || (sp.username ? `@${sp.username}` : "Project")}</span>
                        </div>
                        <p className="text-foreground">{sp.offer_amount} {sp.currency} · {sp.sponsorship_type.replace(/_/g, " ")}</p>
                        {sp.message && <p className="text-muted-foreground text-xs">{sp.message}</p>}
                        {sp.requested_deliverables && <p className="text-muted-foreground text-xs">Deliverables: {sp.requested_deliverables}</p>}
                        {acceptPayoutProposalId === sp.id ? (
                          <div className="rounded-lg border border-border bg-card p-3 space-y-2 mt-2">
                            <p className="text-xs font-medium text-muted-foreground">Record payout destination (payment is off-platform)</p>
                            <p className="text-xs text-muted-foreground">Linkary records the payout destination only. Payment is arranged off-platform between sponsor and host.</p>
                            <label className="block text-xs font-medium text-muted-foreground">Payout method</label>
                            <div className="space-y-1">
                              {(["one_time_wallet", "saved_wallet", "linkary_wallet"] as const).map((m) => (
                                <label key={m} className="flex items-center gap-2 cursor-pointer">
                                  <input type="radio" name="payoutMethod" checked={acceptPayoutMethod === m} onChange={() => { setAcceptPayoutMethod(m); if (m === "linkary_wallet") setAcceptPayoutAddress(""); }} className="rounded-full border-border text-primary" />
                                  <span className="text-sm">{m.replace(/_/g, " ")}</span>
                                </label>
                              ))}
                            </div>
                            {(acceptPayoutMethod === "one_time_wallet" || acceptPayoutMethod === "saved_wallet") && (
                              <>
                                <input type="text" value={acceptPayoutAddress} onChange={(e) => setAcceptPayoutAddress(e.target.value)} placeholder="Wallet address" maxLength={200} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground text-sm" />
                                <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground">
                                  <input type="checkbox" checked={acceptPayoutSaveAsDefault} onChange={(e) => setAcceptPayoutSaveAsDefault(e.target.checked)} className="rounded border-border" />
                                  Save as my default payout wallet
                                </label>
                              </>
                            )}
                            <div className="flex gap-2 flex-wrap">
                              <Button type="button" size="sm" disabled={acceptPayoutSaving || (acceptPayoutMethod !== "linkary_wallet" && !acceptPayoutAddress.trim())} className="rounded-lg" onClick={async () => {
                                setAcceptPayoutSaving(true);
                                const token = await getToken();
                                const res = await fetch(`${base}/api/spaces/${detailsSpace.id}/sponsor-proposals/${sp.id}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                  body: JSON.stringify({ status: "accepted", payout_method: acceptPayoutMethod, payout_wallet_address: acceptPayoutMethod === "linkary_wallet" ? null : acceptPayoutAddress.trim() }),
                                });
                                if (res.ok && acceptPayoutSaveAsDefault && token && (acceptPayoutMethod === "saved_wallet" || acceptPayoutMethod === "one_time_wallet") && acceptPayoutAddress.trim()) {
                                  try {
                                    await fetch(`${base}/api/me/payout-preferences`, {
                                      method: "PUT",
                                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                      body: JSON.stringify({ default_payout_method: "saved_wallet", wallet_address: acceptPayoutAddress.trim() }),
                                    });
                                  } catch {
                                    /* non-blocking */
                                  }
                                }
                                setAcceptPayoutSaving(false);
                                if (res.ok) {
                                  setAcceptPayoutProposalId(null);
                                  setAcceptPayoutAddress("");
                                  setAcceptPayoutSaveAsDefault(false);
                                  loadDetailSponsorProposals(detailsSpace.id);
                                  if (mainNav === "inbox") getToken().then((t) => fetch(`${base}/api/xspaces/inbox`, { headers: t ? { Authorization: `Bearer ${t}` } : {} }).then((r) => r.json()).then((d) => { setInboxProposals(Array.isArray(d?.proposals) ? d.proposals : []); setInboxSpaces(Array.isArray(d?.spaces) ? d.spaces : []); }));
                                }
                              }}>{acceptPayoutSaving ? "…" : "Confirm accept"}</Button>
                              <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => { setAcceptPayoutProposalId(null); setAcceptPayoutAddress(""); setAcceptPayoutSaveAsDefault(false); }}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2 flex-wrap">
                            <Button type="button" size="sm" disabled={resolvingSponsorId === sp.id} className="rounded-lg text-xs bg-primary/20 text-primary border-primary/30" onClick={() => {
                              setAcceptPayoutProposalId(sp.id);
                              setAcceptPayoutMethod("one_time_wallet");
                              setAcceptPayoutAddress("");
                              setAcceptPayoutSaveAsDefault(false);
                              getToken().then(async (token) => {
                                if (!token || !base) return;
                                try {
                                  const res = await fetch(`${base}/api/me/payout-preferences`, { headers: { Authorization: `Bearer ${token}` } });
                                  const data = await res.json().catch(() => ({}));
                                  if (data.default_payout_method === "saved_wallet" && typeof data.wallet_address === "string" && data.wallet_address.trim()) {
                                    setAcceptPayoutMethod("saved_wallet");
                                    setAcceptPayoutAddress((prev) => (prev === "" ? data.wallet_address.trim() : prev));
                                  }
                                } catch {
                                  /* non-blocking */
                                }
                              });
                            }}>Accept</Button>
                            <Button type="button" variant="outline" size="sm" disabled={resolvingSponsorId === sp.id} className="rounded-lg text-xs" onClick={async () => {
                              setResolvingSponsorId(sp.id);
                              const token = await getToken();
                              await fetch(`${base}/api/spaces/${detailsSpace.id}/sponsor-proposals/${sp.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: "declined" }) });
                              setResolvingSponsorId(null);
                              loadDetailSponsorProposals(detailsSpace.id);
                              if (mainNav === "inbox") getToken().then((t) => fetch(`${base}/api/xspaces/inbox`, { headers: t ? { Authorization: `Bearer ${t}` } : {} }).then((r) => r.json()).then((d) => { setInboxProposals(Array.isArray(d?.proposals) ? d.proposals : []); setInboxSpaces(Array.isArray(d?.spaces) ? d.spaces : []); }));
                            }}>Decline</Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
              </div>
              <div className="space-y-4 border-t lg:border-t-0 lg:border-l border-border lg:pl-6 pt-4 lg:pt-0">
                {detailsSpace.scheduled_at && new Date(detailsSpace.scheduled_at) > new Date() && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Starts in</p>
                    <CountdownTimers scheduledAt={detailsSpace.scheduled_at} />
                  </div>
                )}
                {hostAndSpeakers && hostAndSpeakers.speakers.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Speakers</p>
                    <div className="flex flex-wrap gap-2">
                      {hostAndSpeakers.speakers.slice(0, 8).map((p) => (
                        <div key={p.id}>
                          {p.profile_image_url ? (
                            <img src={p.profile_image_url} alt="" className="w-9 h-9 rounded-full object-cover border border-border" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                              {(p.display_name?.trim().slice(0, 2) || p.twitter_username?.slice(0, 2) || "?").toUpperCase()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Combined followers</p>
                  <p className="text-sm font-medium text-foreground">Not available</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 flex-wrap mt-4">
              {isHost(detailsSpace) ? (
                <>
                  <Button type="button" variant="outline" onClick={handleCancelSpace} disabled={editSaving} className="rounded-xl">
                    {editSaving ? "…" : "Cancel space"}
                  </Button>
                  <Button type="button" onClick={handleSaveEdit} disabled={editSaving || (!detailsSpace.x_space_id && !editTitle.trim())} className="rounded-xl">
                    {editSaving ? "…" : "Save"}
                  </Button>
                </>
              ) : me?.id ? (
                <>
                  {spaceSpeakerRequests.length > 0 ? (
                    <div className="mb-2 rounded-xl border border-border bg-card p-3 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Your speaker application</p>
                      <p className="text-sm text-foreground capitalize">{spaceSpeakerRequests[0].status}</p>
                      {spaceSpeakerRequests[0].status === "pending" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={withdrawingRequestId === spaceSpeakerRequests[0].id}
                          className="rounded-xl"
                          onClick={async () => {
                            const sr = spaceSpeakerRequests[0];
                            setWithdrawingRequestId(sr.id);
                            const token = await getToken();
                            await fetch(`${base}/api/xspaces/speaker-request/withdraw`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ request_id: sr.id }) });
                            setWithdrawingRequestId(null);
                            loadDetailSpeakerRequests(detailsSpace.id);
                            loadHostAndSpeakers(detailsSpace.id);
                          }}
                        >
                          {withdrawingRequestId === spaceSpeakerRequests[0].id ? "…" : "Withdraw"}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="mb-2 space-y-2">
                      <label className="block text-xs font-medium text-muted-foreground">Apply as speaker</label>
                      <input type="text" value={speakerRequestTopic} onChange={(e) => setSpeakerRequestTopic(e.target.value)} placeholder="Topic" maxLength={200} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground text-sm" />
                      <textarea value={speakerRequestPitch} onChange={(e) => setSpeakerRequestPitch(e.target.value)} placeholder="Pitch (why you'd like to speak)" rows={2} maxLength={500} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground text-sm" />
                      <input type="text" value={speakerRequestMessage} onChange={(e) => setSpeakerRequestMessage(e.target.value)} placeholder="Message to host (optional)" maxLength={500} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground text-sm" />
                      <Button type="button" onClick={handleRequestSpeaker} disabled={speakerRequesting || !speakerRequestTopic.trim() || !speakerRequestPitch.trim()} className="rounded-xl">{speakerRequesting ? "…" : "Apply as speaker"}</Button>
                    </div>
                  )}
                  {spaceSponsorProposals.length > 0 ? (
                    <div className="mb-2 rounded-xl border border-border bg-card p-3">
                      <p className="text-xs font-medium text-muted-foreground">Your sponsor proposal</p>
                      <p className="text-sm text-foreground capitalize">{spaceSponsorProposals[0].status}</p>
                      <p className="text-xs text-muted-foreground mt-1">{spaceSponsorProposals[0].offer_amount} {spaceSponsorProposals[0].currency} · {spaceSponsorProposals[0].sponsorship_type.replace(/_/g, " ")}</p>
                    </div>
                  ) : (
                    <div className="mb-2 space-y-2">
                      <label className="block text-xs font-medium text-muted-foreground">Apply to sponsor</label>
                      <select value={sponsorApplyType} onChange={(e) => setSponsorApplyType(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground text-sm">
                        <option value="title_sponsor">Title sponsor</option>
                        <option value="co_sponsor">Co-sponsor</option>
                        <option value="giveaway_sponsor">Giveaway sponsor</option>
                        <option value="speaking_slot_sponsor">Speaking slot sponsor</option>
                        <option value="custom">Custom</option>
                      </select>
                      <input type="text" value={sponsorApplyOffer} onChange={(e) => setSponsorApplyOffer(e.target.value)} placeholder="Offer amount" className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground text-sm" />
                      <select value={sponsorApplyCurrency} onChange={(e) => setSponsorApplyCurrency(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground text-sm">
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="USDC">USDC</option>
                      </select>
                      <input type="text" value={sponsorApplyMessage} onChange={(e) => setSponsorApplyMessage(e.target.value)} placeholder="Message (optional)" maxLength={2000} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground text-sm" />
                      <input type="text" value={sponsorApplyDeliverables} onChange={(e) => setSponsorApplyDeliverables(e.target.value)} placeholder="Requested deliverables (optional)" maxLength={2000} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground text-sm" />
                      <Button type="button" disabled={sponsorProposalSubmitting || !sponsorApplyOffer.trim()} className="rounded-xl" onClick={async () => {
                        if (!detailsSpace || !me?.id || isHost(detailsSpace)) return;
                        const amount = parseFloat(sponsorApplyOffer.trim());
                        if (!Number.isFinite(amount) || amount <= 0) { setSponsorProposalError("Offer amount must be greater than 0."); return; }
                        if (amount >= 1_000_000) { setSponsorProposalError("Offer amount must be less than 1,000,000."); return; }
                        setSponsorProposalSubmitting(true);
                        setSponsorProposalError(null);
                        const token = await getToken();
                        const res = await fetch(`${base}/api/spaces/${detailsSpace.id}/sponsor-proposals`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                          body: JSON.stringify({
                            offer_amount: amount,
                            currency: sponsorApplyCurrency,
                            sponsorship_type: sponsorApplyType,
                            message: sponsorApplyMessage.trim() || undefined,
                            requested_deliverables: sponsorApplyDeliverables.trim() || undefined,
                          }),
                        });
                        const data = await res.json().catch(() => ({}));
                        setSponsorProposalSubmitting(false);
                        if (res.ok) {
                          setSponsorApplyOffer("");
                          setSponsorApplyMessage("");
                          setSponsorApplyDeliverables("");
                          loadDetailSponsorProposals(detailsSpace.id);
                        } else setSponsorProposalError(sanitizeErrorMessage(data.error ?? "Failed to submit."));
                      }}>{sponsorProposalSubmitting ? "…" : "Submit proposal"}</Button>
                      {sponsorProposalError && <p className="text-xs text-destructive">{sponsorProposalError}</p>}
                    </div>
                  )}
                  {/* non-host: speaker + sponsor sections above */}
                  {false && (
                    <div className="hidden">
                      <input type="text" placeholder="Topic" maxLength={200} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground text-sm" readOnly />
                      <textarea
                        value={speakerRequestPitch}
                        onChange={(e) => setSpeakerRequestPitch(e.target.value)}
                        placeholder="Pitch (why you’d like to speak)"
                        rows={2}
                        maxLength={500}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground text-sm"
                      />
                      <input
                        type="text"
                        value={speakerRequestMessage}
                        onChange={(e) => setSpeakerRequestMessage(e.target.value)}
                        placeholder="Message to host (optional)"
                        maxLength={500}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground text-sm"
                      />
                      <Button type="button" onClick={handleRequestSpeaker} disabled={speakerRequesting || !speakerRequestTopic.trim() || !speakerRequestPitch.trim()} className="rounded-xl">
                        {speakerRequesting ? "…" : "Apply as speaker"}
                      </Button>
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      const token = await getToken();
                      const res = await fetch(`${base}/api/xspaces/rsvp`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ space_id: detailsSpace.id, status: "interested" }),
                      });
                      const data = await res.json().catch(() => ({}));
                      if (res.ok && (data?.status === "interested" || data?.status === "going")) setRsvpStatus((prev) => ({ ...prev, [detailsSpace.id]: data.status }));
                    }}
                    className="rounded-xl"
                  >
                    Interested
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      const token = await getToken();
                      const res = await fetch(`${base}/api/xspaces/rsvp`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ space_id: detailsSpace.id, status: "going" }),
                      });
                      const data = await res.json().catch(() => ({}));
                      if (res.ok && (data?.status === "interested" || data?.status === "going")) setRsvpStatus((prev) => ({ ...prev, [detailsSpace.id]: data.status }));
                    }}
                    className="rounded-xl border-primary text-primary hover:bg-primary/10"
                  >
                    Going
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </>
      )}
      </main>
    </div>
    </XSpacesErrorBoundary>
  );
}
