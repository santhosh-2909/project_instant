'use client';

import * as React from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  EmptyState,
  Input,
  Skeleton,
  SortableTh,
  Table,
  TableEmpty,
  TableWrap,
  VerdictBadge,
  tableNumeric,
  type SortDir,
} from '@/client/components/ui';

interface HistoryRecord {
  historyId: string;
  title: string;
  url: string | null;
  category: string;
  verdict: string;
  confidence: number;
  verifiedAt: string;
  verifiedBy: string;
}

const VERDICTS = ['All', 'Real', 'Fake', 'Uncertain'] as const;
const PAGE_SIZE = 25;

export function HistoryTable() {
  const [records, setRecords] = React.useState<HistoryRecord[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [page, setPage] = React.useState(0);
  const [verdict, setVerdict] = React.useState<string>('All');
  const [search, setSearch] = React.useState('');
  const [sortKey, setSortKey] = React.useState<string | null>('verifiedAt');
  const [dir, setDir] = React.useState<SortDir>('desc');

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [unauthenticated, setUnauthenticated] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(page * PAGE_SIZE),
        });
        if (verdict !== 'All') params.set('verdict', verdict);

        const response = await fetch(`/api/history?${params}`);

        if (response.status === 401) {
          if (!cancelled) setUnauthenticated(true);
          return;
        }

        const data = await response.json();
        if (cancelled) return;

        if (!response.ok) {
          setError(data.error ?? 'Could not load history.');
          return;
        }

        setRecords(data.records);
        setTotalCount(data.totalCount);
      } catch {
        if (!cancelled) setError('Could not reach the server.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [page, verdict]);

  const onSort = (key: string) => {
    if (sortKey === key) {
      setDir((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setDir('desc');
    }
  };

  const visible = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term
      ? records.filter(
          (r) => r.title.toLowerCase().includes(term) || r.category.toLowerCase().includes(term)
        )
      : records;

    if (!sortKey) return filtered;

    return [...filtered].sort((a, b) => {
      const av = a[sortKey as keyof HistoryRecord];
      const bv = b[sortKey as keyof HistoryRecord];
      const comparison =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av ?? '').localeCompare(String(bv ?? ''));
      return dir === 'asc' ? comparison : -comparison;
    });
  }, [records, search, sortKey, dir]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  if (unauthenticated) {
    return (
      <Card>
        <CardBody>
          <EmptyState
            icon="⌘"
            title="Sign in to see your verification history"
            description="Saved history is tied to your account. Checks you run while signed out stay in your browser only."
            action={
              <a href="/login">
                <Button>Sign in</Button>
              </a>
            }
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Verification history"
        description={`${totalCount} record${totalCount === 1 ? '' : 's'}`}
        action={
          <div className="row">
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search this page…"
              aria-label="Search verification history"
              style={{ width: 220 }}
            />
          </div>
        }
      />

      <CardBody>
        <div className="row wrap" style={{ marginBottom: 'var(--space-5)' }} role="group" aria-label="Filter by verdict">
          {VERDICTS.map((option) => (
            <Button
              key={option}
              size="sm"
              variant={verdict === option ? 'primary' : 'outline'}
              onClick={() => {
                setVerdict(option);
                setPage(0);
              }}
              aria-pressed={verdict === option}
            >
              {option}
            </Button>
          ))}
        </div>

        {error && (
          <Alert tone="error" title="Could not load history">
            {error}
          </Alert>
        )}

        {loading ? (
          <div className="stack stack-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} height={44} />
            ))}
          </div>
        ) : (
          <TableWrap>
            <Table>
              <caption className="sr-only">Verification history, sortable by column</caption>
              <thead>
                <tr>
                  <SortableTh label="Claim" sortKey="title" activeKey={sortKey} dir={dir} onSort={onSort} />
                  <SortableTh label="Category" sortKey="category" activeKey={sortKey} dir={dir} onSort={onSort} />
                  <SortableTh label="Verdict" sortKey="verdict" activeKey={sortKey} dir={dir} onSort={onSort} />
                  <SortableTh
                    label="Confidence"
                    sortKey="confidence"
                    activeKey={sortKey}
                    dir={dir}
                    onSort={onSort}
                    numeric
                  />
                  <SortableTh label="Checked" sortKey="verifiedAt" activeKey={sortKey} dir={dir} onSort={onSort} />
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <TableEmpty colSpan={5}>
                    {search
                      ? `No records on this page match “${search}”.`
                      : 'No verifications recorded yet.'}
                  </TableEmpty>
                ) : (
                  visible.map((record) => (
                    <tr key={record.historyId}>
                      <td>
                        {record.url ? (
                          <a href={record.url} target="_blank" rel="noopener noreferrer">
                            {record.title}
                          </a>
                        ) : (
                          record.title
                        )}
                      </td>
                      <td>
                        <Badge tone="neutral">{record.category}</Badge>
                      </td>
                      <td>
                        <VerdictBadge verdict={record.verdict} />
                      </td>
                      <td className={tableNumeric}>{Math.round(record.confidence)}%</td>
                      <td className="muted">{new Date(record.verifiedAt).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </CardBody>

      <CardFooter>
        <span className="text-sm muted">
          Page {page + 1} of {totalPages}
        </span>
        <div className="row">
          <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage((p) => p + 1)}
            disabled={page + 1 >= totalPages}
          >
            Next
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
