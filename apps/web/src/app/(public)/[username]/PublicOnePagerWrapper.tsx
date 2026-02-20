"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PublicEntity } from "@/lib/publicData";
import { PublicOnePager } from "@/components/public/PublicOnePager";

export function PublicOnePagerWrapper({
  entity,
  username,
}: {
  entity: PublicEntity;
  username: string;
}) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      setIsLoggedIn(!!user);
      if (!user?.id) {
        setIsOwner(false);
        return;
      }
      if (entity.type === "profile" && entity.profile?.id === user.id) {
        setIsOwner(true);
        return;
      }
      if (entity.type === "org" && entity.org?.id) {
        const { data: member } = await supabase
          .from("org_members")
          .select("role")
          .eq("org_id", entity.org.id)
          .eq("user_id", user.id)
          .maybeSingle();
        setIsOwner(!!member && ["owner", "admin"].includes((member as { role: string }).role));
        return;
      }
      setIsOwner(false);
    })();
  }, [entity.type, entity.profile?.id, entity.org?.id]);

  return (
    <PublicOnePager
      entity={entity}
      username={username}
      isLoggedIn={isLoggedIn}
      isOwner={isOwner}
    />
  );
}
