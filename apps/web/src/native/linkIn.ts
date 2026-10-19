// Site links a phone's browser hands over: `raven://open?url=<link>` (the web app's OpenInApp), or the page from Safari's Smart App Banner.
import { siteOrigin } from "@lib/site"
import { pendingLink } from "./pending"
import { listenNative, nativePlatform } from "./platform"
import { openNotificationTarget, resolveNotificationTarget } from "./push"
import { loadSites, setDefaultSite } from "./sites"

// Links opened this session, kept over reloads: Android repeats its launch link on every one.
const OPENED_KEY = "raven-opened-links"
const KEEP_OPENED = 20

const openedLinks = (): string[] => {
    try { return JSON.parse(sessionStorage.getItem(OPENED_KEY) ?? "[]") as string[] } catch { return [] }
}

/** The session's opened links with one more; every one stays known, so none replays after a later one. */
export const withOpened = (opened: string[], appUrl: string): string[] => [...opened, appUrl].slice(-KEEP_OPENED)

/**
 * The site link in an address the app was opened with: `raven://open?url=<link>` from the web app, or the
 * page itself from Safari's Smart App Banner. Null for anything else, shares (`raven://?…`) included.
 */
export const linkFromAppUrl = (appUrl: string): string | null => {
    if (/^https?:\/\//i.test(appUrl)) return appUrl
    const query = /^raven:\/\/open\/?\?(.*)$/.exec(appUrl)?.[1]
    const link = query ? new URLSearchParams(query).get("url") : null
    return link && /^https?:\/\//i.test(link) ? link : null
}

/** Links that arrive while the app runs, and the one it was launched with. */
export const subscribeSiteLinks = (open: (link: string) => void): (() => void) => {
    const take = (appUrl: string) => {
        const link = linkFromAppUrl(appUrl)
        if (!link) return
        sessionStorage.setItem(OPENED_KEY, JSON.stringify(withOpened(openedLinks(), appUrl)))
        open(link)
    }
    const unListen = listenNative(async () => (await import("@capacitor/app")).App.addListener("appUrlOpen", ({ url }) => take(url)))
    // iOS keeps a launch link for this listener; Android only answers getLaunchUrl.
    if (nativePlatform() === "android") {
        void import("@capacitor/app")
            .then(({ App }) => App.getLaunchUrl())
            .then((launch) => { if (launch?.url && !openedLinks().includes(launch.url)) take(launch.url) })
            .catch(() => { })
    }
    return unListen
}

/** Whether a link is for the open site, another saved one, or a site to add. */
export const linkAction = (link: string, current: string | null, saved: string[]): "here" | "switch" | "add" => {
    const origin = new URL(link).origin
    if (origin === current) return "here"
    return saved.includes(origin) ? "switch" : "add"
}

/** A link to this site navigates; to another saved site, that site opens on it; to any other, the picker offers it. */
export const openSiteLink = async (link: string, navigate: (path: string) => void) => {
    if (linkAction(link, siteOrigin(), (await loadSites()).map((s) => s.url)) !== "add") {
        return openNotificationTarget({ message_url: link }, navigate)
    }
    await pendingLink.set(link)
    await setDefaultSite(null)
    window.location.replace("/")
}

/** Once a site opens: the page of the link that led here, if the user signed in to that link's site. */
export const followPendingLink = async (navigate: (path: string) => void) => {
    const link = await pendingLink.take()
    const target = link ? resolveNotificationTarget({ message_url: link }, siteOrigin()) : null
    if (target?.kind === "same-site") navigate(target.path)
}
