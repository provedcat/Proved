#!/usr/bin/env python3
import json, os, re, sys, mimetypes
from io import BytesIO
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from PIL import Image

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154 Safari/537.36 ProvedBrandLogoCollector/1.0"
TIMEOUT = 25
OUT_DIR = "assets/brand-logos"
REPORT_PATH = "data/brand-logo-report.json"

def norm(s):
    return re.sub(r"[^a-z0-9가-힣]+", "", (s or "").lower())

def brand_tokens(name):
    raw = re.split(r"[^A-Za-z0-9가-힣]+", name or "")
    toks = [norm(x) for x in raw if len(norm(x)) >= 3]
    return sorted(set(toks), key=len, reverse=True)

def pick_src(img):
    attrs = ["src", "data-src", "data-lazy-src", "data-original", "data-image"]
    vals = [img.get(a) for a in attrs if img.get(a)]
    for key in ("srcset", "data-srcset"):
        ss = img.get(key)
        if ss:
            parts = [p.strip().split()[0] for p in ss.split(",") if p.strip()]
            vals.extend(reversed(parts))
    return vals[0] if vals else None

def score_img(img, src, name):
    text = " ".join([
        str(img.get("alt") or ""), str(img.get("title") or ""),
        " ".join(img.get("class") or []), str(img.get("id") or ""), src or ""
    ])
    ntext = norm(text)
    score = 0
    if "logo" in text.lower(): score += 10
    for t in brand_tokens(name):
        if t and t in ntext: score += 5
    anc = img
    for _ in range(4):
        anc = getattr(anc, "parent", None)
        if not anc: break
        if getattr(anc, "name", "") in ("header", "nav"): score += 4
        if getattr(anc, "name", "") == "footer": score += 2
        c = " ".join(anc.get("class") or []) if hasattr(anc, "get") else ""
        i = str(anc.get("id") or "") if hasattr(anc, "get") else ""
        if "logo" in (c+" "+i).lower(): score += 4
    low = (src or "").lower()
    if any(x in low for x in ("favicon", "apple-touch", "icon-", "/icons/", "sprite", "pixel", "tracking")): score -= 10
    if low.endswith(".svg") or ".svg?" in low: score += 3
    elif any(ext in low for ext in (".png", ".webp")): score += 2
    return score

def validate_bytes(data, ctype, url):
    c = (ctype or "").split(";")[0].strip().lower()
    low = url.lower()
    if "svg" in c or low.endswith(".svg") or data.lstrip().startswith(b"<svg"):
        txt = data[:5000].lower()
        if b"<svg" not in txt:
            return False, None, None, None
        return True, "svg", "image/svg+xml", None
    try:
        im = Image.open(BytesIO(data))
        w, h = im.size
        if w < 60 or h < 20 or w*h < 2500:
            return False, None, None, (w,h)
        fmt = (im.format or "").lower()
        ext = "jpg" if fmt == "jpeg" else fmt
        mime = Image.MIME.get(im.format, c or mimetypes.guess_type("x."+ext)[0] or "application/octet-stream")
        return True, ext, mime, (w,h)
    except Exception:
        return False, None, None, None

def collect_one(session, brand):
    name, slug, page = brand["name"], brand["slug"], brand["official_url"]
    rec = {"name":name,"slug":slug,"official_url":page,"status":"hold"}
    try:
        r = session.get(page, timeout=TIMEOUT, allow_redirects=True)
        rec["final_page_url"] = r.url
        rec["page_status"] = r.status_code
        if r.status_code >= 400:
            rec["reason"] = f"page_http_{r.status_code}"
            return rec
        soup = BeautifulSoup(r.text, "html.parser")
        candidates = []
        for img in soup.find_all("img"):
            src = pick_src(img)
            if not src: continue
            absu = urljoin(r.url, src)
            s = score_img(img, absu, name)
            if s >= 8:
                candidates.append((s, absu, "img"))
        # CSS background images on likely logo/header elements.
        for el in soup.find_all(style=True):
            marker = (" ".join(el.get("class") or [])+" "+str(el.get("id") or "")).lower()
            if "logo" not in marker and getattr(getattr(el,"parent",None),"name","") not in ("header","nav"):
                continue
            for u in re.findall(r"url\((['\"]?)(.*?)\1\)", el.get("style") or ""):
                absu=urljoin(r.url,u[1])
                candidates.append((9 if "logo" in marker else 8, absu, "css"))
        # Inline SVG explicitly marked as logo.
        for svg in soup.find_all("svg"):
            marker = (" ".join(svg.get("class") or [])+" "+str(svg.get("id") or "")+" "+str(svg.get("aria-label") or "")).lower()
            parent = svg.parent
            pmark = ""
            if parent and hasattr(parent,"get"):
                pmark=(" ".join(parent.get("class") or [])+" "+str(parent.get("id") or "")).lower()
            if "logo" in marker or "logo" in pmark:
                data=str(svg).encode("utf-8")
                fn=os.path.join(OUT_DIR, slug+".svg")
                os.makedirs(OUT_DIR, exist_ok=True)
                with open(fn,"wb") as f: f.write(data)
                rec.update({"status":"auto_approved","asset_url":r.url+"#inline-svg","asset_kind":"inline_svg","file":fn,"mime":"image/svg+xml","score":12})
                return rec
        if not candidates:
            rec["reason"]="no_high_confidence_logo_candidate"
            return rec
        candidates.sort(key=lambda x:x[0], reverse=True)
        top = candidates[0]
        # Ambiguous if two different candidates tie exactly at top.
        if len(candidates)>1 and candidates[1][0] == top[0] and candidates[1][1] != top[1]:
            rec["reason"]="ambiguous_top_candidates"
            rec["candidates"]=[{"score":s,"url":u,"kind":k} for s,u,k in candidates[:5]]
            return rec
        s, asset_url, kind = top
        ar = session.get(asset_url, timeout=TIMEOUT, allow_redirects=True, headers={"Referer":r.url, "User-Agent":UA})
        if ar.status_code >= 400:
            rec["reason"]=f"asset_http_{ar.status_code}"
            rec["asset_url"]=asset_url
            return rec
        ok, ext, mime, dims = validate_bytes(ar.content, ar.headers.get("content-type"), ar.url)
        if not ok:
            rec["reason"]="asset_validation_failed"
            rec["asset_url"]=ar.url
            return rec
        os.makedirs(OUT_DIR, exist_ok=True)
        fn=os.path.join(OUT_DIR, slug+"."+ext)
        with open(fn,"wb") as f: f.write(ar.content)
        rec.update({"status":"auto_approved","asset_url":ar.url,"asset_kind":kind,"file":fn,"mime":mime,"dimensions":dims,"score":s})
        return rec
    except Exception as e:
        rec["reason"]="exception"
        rec["error"]=repr(e)[:500]
        return rec

def main():
    manifest=json.load(open("scripts/brand-logo-manifest.json",encoding="utf-8"))
    os.makedirs("data", exist_ok=True)
    s=requests.Session()
    s.headers.update({"User-Agent":UA,"Accept":"text/html,application/xhtml+xml,image/avif,image/webp,*/*;q=0.8"})
    report=[]
    for i,b in enumerate(manifest["brands"],1):
        print(f"[{i}/{manifest['count']}] {b['name']} -> {b['official_url']}", flush=True)
        rec=collect_one(s,b)
        print("   ",rec["status"],rec.get("asset_url") or rec.get("reason"), flush=True)
        report.append(rec)
    summary={}
    for r in report: summary[r["status"]]=summary.get(r["status"],0)+1
    with open(REPORT_PATH,"w",encoding="utf-8") as f:
        json.dump({"summary":summary,"results":report},f,ensure_ascii=False,indent=2)
    print("SUMMARY",summary)

if __name__=="__main__":
    main()
