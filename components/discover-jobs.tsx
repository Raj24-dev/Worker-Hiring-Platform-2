"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2, Search, SearchX } from "lucide-react";
import { JobCard } from "@/components/job-card";
import { EmptyState } from "@/components/page-bits";
import { Input } from "@/components/ui/input";
import type { JobWithEmployer } from "@/lib/queries";

type Payload = { jobs: JobWithEmployer[]; applied: number[] };

export function DiscoverJobs({
  initial,
  workerLocation,
}: {
  initial: Payload;
  workerLocation: string | null;
}) {
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");

  // Wait for a pause in typing before asking the server.
  useEffect(() => {
    const t = setTimeout(() => setQuery(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);

  const { data, isFetching, isError } = useQuery<Payload>({
    queryKey: ["jobs", query],
    queryFn: async () => {
      const res = await fetch(`/api/jobs?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Could not load jobs");
      return res.json();
    },
    initialData: query === "" ? initial : undefined,
    placeholderData: keepPreviousData,
  });

  const jobs = data?.jobs ?? [];
  const applied = new Set(data?.applied ?? []);

  return (
    <>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search work, skill or area"
          aria-label="Search jobs"
          className="h-12 pl-11 text-base md:text-base"
        />
        {isFetching && (
          <Loader2 className="absolute top-1/2 right-3.5 size-4.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {isError ? (
        <EmptyState
          icon={SearchX}
          title="Could not load jobs"
          hint="Please check your connection and try again."
        />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={query ? "No jobs match that search" : "No jobs open right now"}
          hint={
            query
              ? "Try a different word, or clear the search to see everything."
              : "New work is posted every day. Check back soon."
          }
        />
      ) : (
        <div className="grid gap-3">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              href={`/jobs/${job.id}`}
              workerLocation={workerLocation}
              applicationStatus={applied.has(job.id) ? "applied" : undefined}
            />
          ))}
        </div>
      )}
    </>
  );
}
