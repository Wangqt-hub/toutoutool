"use client";

import {
  type ImgHTMLAttributes,
  type SyntheticEvent,
  useEffect,
  useRef,
  useState,
} from "react";

type AutoRefreshImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src"
> & {
  src?: string | null;
  onRefreshSrc?: () => Promise<string | null | undefined>;
};

export function AutoRefreshImage({
  src,
  onError,
  onRefreshSrc,
  ...props
}: AutoRefreshImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState(src ?? null);
  const [refreshing, setRefreshing] = useState(false);
  const attemptedSrcRef = useRef<string | null>(null);

  useEffect(() => {
    setResolvedSrc(src ?? null);
    attemptedSrcRef.current = null;
  }, [src]);

  async function handleError(event: SyntheticEvent<HTMLImageElement, Event>) {
    onError?.(event);

    if (!onRefreshSrc || refreshing || !resolvedSrc) {
      return;
    }

    if (attemptedSrcRef.current === resolvedSrc) {
      return;
    }

    attemptedSrcRef.current = resolvedSrc;
    setRefreshing(true);

    try {
      const nextSrc = await onRefreshSrc();

      if (nextSrc && nextSrc !== resolvedSrc) {
        setResolvedSrc(nextSrc);
        attemptedSrcRef.current = null;
      }
    } finally {
      setRefreshing(false);
    }
  }

  if (!resolvedSrc) {
    return null;
  }

  return <img {...props} src={resolvedSrc} onError={handleError} />;
}
