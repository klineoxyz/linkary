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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session?.user);
    });
  }, []);

  return (
    <PublicOnePager
      entity={entity}
      username={username}
      isLoggedIn={isLoggedIn}
    />
  );
}
