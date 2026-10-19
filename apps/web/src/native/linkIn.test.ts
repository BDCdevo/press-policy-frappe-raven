import { describe, expect, it } from "vitest"

import { linkAction, linkFromAppUrl, withOpened } from "./linkIn"

const site = "https://a.com/raven/ws/general"

describe("linkFromAppUrl", () => {
    it("reads the site link a raven://open address carries", () => {
        expect(linkFromAppUrl(`raven://open?url=${encodeURIComponent(site)}`)).toBe(site)
    })
    it("takes the slash some browsers add before the query", () => {
        expect(linkFromAppUrl(`raven://open/?url=${encodeURIComponent(site)}`)).toBe(site)
    })
    it("takes the page Safari's Smart App Banner passes as is", () => {
        expect(linkFromAppUrl(site)).toBe(site)
    })
    it("ignores shares, other schemes and non-web links", () => {
        expect(linkFromAppUrl("raven://?title=a&url=b")).toBeNull()
        expect(linkFromAppUrl(`raven.thecommit.company://oauth?url=${encodeURIComponent(site)}`)).toBeNull()
        expect(linkFromAppUrl(`raven://open?url=${encodeURIComponent("javascript:alert(1)")}`)).toBeNull()
        expect(linkFromAppUrl("raven://open")).toBeNull()
    })
})

describe("withOpened", () => {
    it("keeps the launch link known after later links, so a reload doesn't replay it", () => {
        const opened = withOpened(withOpened([], "raven://open?url=one"), "raven://open?url=two")
        expect(opened).toContain("raven://open?url=one")
    })
    it("keeps only the latest few", () => {
        let opened: string[] = []
        for (let i = 0; i < 30; i++) opened = withOpened(opened, `raven://open?url=${i}`)
        expect(opened).toHaveLength(20)
        expect(opened[19]).toBe("raven://open?url=29")
    })
})

describe("linkAction", () => {
    const saved = ["https://a.com", "https://b.com"]
    it("stays on the open site for its own links", () => {
        expect(linkAction("https://a.com/raven/threads", "https://a.com", saved)).toBe("here")
    })
    it("switches to another saved site", () => {
        expect(linkAction("https://b.com/raven/threads", "https://a.com", saved)).toBe("switch")
    })
    it("adds a site that isn't saved, with or without a site open", () => {
        expect(linkAction("https://c.com/raven/threads", "https://a.com", saved)).toBe("add")
        expect(linkAction("https://c.com/raven/threads", null, [])).toBe("add")
    })
})
