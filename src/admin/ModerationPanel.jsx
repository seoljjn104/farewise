import { useStore } from '../lib/store.js'
import { categoryById, severityById } from '../lib/advisoryMeta.js'
import { Badge, Btn } from '../components/ui.jsx'
import { clockTime } from '../lib/format.js'

export default function ModerationPanel() {
  const { advisories, actions } = useStore()
  const pending = advisories.filter((a) => a.status === 'pending')
  const published = advisories.filter((a) => a.status === 'published')
  const pendingCount = pending.length
  const publishedCount = published.length

  function handleDelete(id) {
    actions.deleteAdvisory(id)
  }
  function handlePublish(id) {
    actions.setAdvisoryStatus(id, 'published')
  }
  function handleReject(id) {
    actions.setAdvisoryStatus(id, 'rejected')
  }
  function handleUnpublish(id) {
    actions.setAdvisoryStatus(id, 'pending')
  }
  function handleDeletePublished(id) {
    actions.deleteAdvisory(id)
  }

  function PendingAdvisory({ advisory }) {
    const category = categoryById(advisory.categoryId) || { label: '—' }
    const severity = severityById(advisory.severity) || { label: '—' }
    return (
      <section className="panel p-4 lg:p-5 border-b border-line">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Badge tone={severity.tone || 'neutral'} className="shrink-0">
              {severity.label}
            </Badge>
            <span className="text-[11px] font-semibold text-fg">{advisory.title}</span>
          </div>
          <p className="text-[10.5px] leading-relaxed text-faint">
            {advisory.body}
          </p>
          <div className="flex items-center gap-2 text-[10px] text-fg-dim">
            <span>{category.label} · {advisory.area}</span>
            <span>•</span>
            <span>{advisory.author}</span>
            <span>·</span>
            <span>{clockTime(advisory.createdAt)}</span>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Btn
            variant="danger"
            icon="trash"
            onClick={() => handleDelete(advisory.id)}
            aria-label={`Delete advisory ${advisory.id}`}
          >
            Delete
          </Btn>
          <Btn
            variant="primary"
            icon="check"
            onClick={() => handlePublish(advisory.id)}
            aria-label={`Approve advisory ${advisory.id}`}
          >
            Approve
          </Btn>
          <Btn
            variant="secondary"
            icon="x"
            onClick={() => handleReject(advisory.id)}
            aria-label={`Reject advisory ${advisory.id}`}
          >
            Reject
          </Btn>
        </div>
      </section>
    )
  }

  function PublishedAdvisory({ advisory }) {
    const category = categoryById(advisory.categoryId) || { label: '—' }
    const severity = severityById(advisory.severity) || { label: '—' }
    return (
      <section className="panel p-4 lg:p-5 border-t border-line">
        <div className="flex items-center gap-2">
          <Badge tone={severity.tone || 'neutral'} className="shrink-0">
            {severity.label}
          </Badge>
          <span className="text-[11px] font-semibold text-fg">{advisory.title}</span>
        </div>
        <p className="text-[10.5px] leading-relaxed text-faint">
          {advisory.body}
        </p>
        <div className="mt-2 flex items-center gap-2 text-[10px] text-fg-dim">
          <span>{category.label} · {advisory.area}</span>
          <span>•</span>
          <span>{advisory.author}</span>
          <span>·</span>
          <span>{clockTime(advisory.createdAt)}</span>
        </div>
        <div className="mt-3 flex gap-2">
          <Btn
            variant="info"
            icon="sync"
            onClick={() => handleUnpublish(advisory.id)}
            aria-label={`Unpublish advisory ${advisory.id}`}
          >
            Unpublish
          </Btn>
          <Btn
            variant="danger"
            icon="trash"
            onClick={() => handleDeletePublished(advisory.id)}
            aria-label={`Delete advisory ${advisory.id}`}
          >
            Delete
          </Btn>
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-3">
      {/* ---------------------------------------------------------- pending */}
      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 lg:px-5">
          <p className="label-xs">Pending</p>
          <span className="num text-[12px] text-fg-dim">{pendingCount}</span>
        </div>

        {pending.length === 0 ? (
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            No pending advisories.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[#1d2530]">
            {pending.map((advisory) => (
              <li key={advisory.id} className="py-3">
                <PendingAdvisory advisory={advisory} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------------------------------------------------------- published */}
      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 lg:px-5">
          <p className="label-xs">Published</p>
          <span className="num text-[12px] text-fg-dim">{publishedCount}</span>
        </div>

        {published.length === 0 ? (
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            No published advisories.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[#1d2530]">
            {published.map((advisory) => (
              <li key={advisory.id} className="py-3">
                <PublishedAdvisory advisory={advisory} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}