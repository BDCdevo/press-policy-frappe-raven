import { useRef, useState } from "react"
import { ExternalLinkIcon } from "lucide-react"
import { Button } from "@components/ui/button"
import _ from "@lib/translate"
import { cn } from "@lib/utils"
import { dismissApp, offersApp, openInApp } from "@utils/openInApp"

// Travel before a touch counts as a swipe rather than a tap.
const SLOP = 12
// Half the bar's height: past this, letting go dismisses it. A flick clears it anyway.
const DISMISS_DISTANCE = 24
// The slide-out and collapse; the bar is removed once they're done.
const LEAVE_MS = 200

type Drag = { id: number; x: number; y: number; active: boolean }

/** On a phone browser: offers to open this site's links in the Raven app from now on; swipe up to dismiss. */
export const OpenInAppBar = () => {
    const [shown, setShown] = useState(offersApp)
    const [leaving, setLeaving] = useState(false)
    const [offset, setOffset] = useState(0)
    const [dragging, setDragging] = useState(false)
    const drag = useRef<Drag | null>(null)
    // The click a finished drag leaves behind must not open the app.
    const swallowClick = useRef(false)

    if (!shown) return null

    const onPointerDown = (event: React.PointerEvent) => {
        if (event.pointerType !== "touch" || drag.current) return
        swallowClick.current = false
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, active: false }
    }

    const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const d = drag.current
        if (!d || d.id !== event.pointerId) return
        const dx = event.clientX - d.x
        const dy = event.clientY - d.y
        if (!d.active) {
            if (Math.abs(dx) > SLOP && Math.abs(dx) > Math.abs(dy)) { drag.current = null; return }
            if (-dy <= SLOP) return
            d.active = true
            setDragging(true)
            event.currentTarget.setPointerCapture(event.pointerId)
        }
        setOffset(Math.min(0, dy))
    }

    const onPointerEnd = (event: React.PointerEvent) => {
        const d = drag.current
        if (!d || d.id !== event.pointerId) return
        drag.current = null
        if (!d.active) return
        setDragging(false)
        swallowClick.current = true
        if (event.type === "pointercancel" || d.y - event.clientY <= DISMISS_DISTANCE) return setOffset(0)
        dismissApp()
        setLeaving(true)
        // A timer, not transitionend: a browser that can't animate grid rows never sends it.
        setTimeout(() => setShown(false), LEAVE_MS)
    }

    return (
        // Collapses after sliding out, so the page closes the gap instead of jumping.
        <div className={cn("grid shrink-0 transition-[grid-template-rows] duration-200 ease-out", leaving ? "grid-rows-[0fr]" : "grid-rows-[1fr]")}>
            <div
                className={cn(
                    // No padding here: it couldn't collapse. The row inside carries it.
                    "relative min-h-0 touch-none overflow-hidden border-b border-outline-gray-1 bg-surface-gray-2",
                    dragging ? "transition-none" : "transition-[transform,opacity] duration-200 ease-out",
                )}
                style={{ transform: leaving ? "translateY(-100%)" : offset ? `translateY(${offset}px)` : undefined, opacity: leaving ? 0 : undefined }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerEnd}
                onPointerCancel={onPointerEnd}
                onClickCapture={(event) => {
                    if (!swallowClick.current) return
                    swallowClick.current = false
                    event.stopPropagation()
                }}
            >
                <div className="flex items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-base text-ink-gray-8">{_("Open in the Raven app")}</span>
                    <Button size="md" onClick={() => { setShown(false); openInApp({ orStore: true }) }}>
                        {_("Open")}
                        <ExternalLinkIcon aria-hidden />
                    </Button>
                </div>
                {/* Handle: says the bar swipes away. */}
                <span aria-hidden className="absolute bottom-0.5 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-surface-gray-4" />
            </div>
        </div>
    )
}
