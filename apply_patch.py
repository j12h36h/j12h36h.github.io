from pathlib import Path
import sys

ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd().resolve()
HERE = Path(__file__).resolve().parent


def read(rel):
    p = ROOT / rel
    if not p.exists():
        raise SystemExit(f"Missing expected repository file: {rel}")
    return p.read_text(encoding="utf-8")


def write(rel, text):
    p = ROOT / rel
    p.write_text(text, encoding="utf-8", newline="\n")
    print(f"patched {rel}")


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Patch guard failed for {label}: expected exactly 1 match, found {count}. Repository may have changed.")
    return text.replace(old, new, 1)


# 1) Marketplace page + immutable/archive client behavior.
write("content/index.html", (HERE / "replacements/content/index.html").read_text(encoding="utf-8"))
write("content/assets/market.js", (HERE / "replacements/content/assets/market.js").read_text(encoding="utf-8"))

css_rel = "content/assets/market.css"
css = read(css_rel)
css_marker = "/* Immutable holdings + recoverable Asset Archive */"
if css_marker not in css:
    css += (HERE / "snippets/market-archive.css").read_text(encoding="utf-8")
    write(css_rel, css)
else:
    print(f"already patched {css_rel}")

# 2) Trade UI: archived holdings must disappear from all trade/offer selectors.
trade_rel = "trade/assets/trade.js"
trade = read(trade_rel)
trade_old = "state.holdings=s.docs.map(d=>({id:d.id,...d.data()}));\n    renderInventory(); refreshAssetSelects(); renderTradeBook();"
trade_new = "state.holdings=s.docs.map(d=>({id:d.id,...d.data()})).filter(h=>h.archived!==true);\n    renderInventory(); refreshAssetSelects(); renderTradeBook();"
if trade_new not in trade:
    trade = replace_once(trade, trade_old, trade_new, "trade active-holdings filter")
    write(trade_rel, trade)
else:
    print(f"already patched {trade_rel}")

# 3) Hosted game builder: archived holdings must disappear from host asset/bundle selectors.
host_rel = "game/host/host.js"
host = read(host_rel)
host_old = "state.holdings=s.docs.map(d=>({id:d.id,...d.data()}));state.selectedHostAssets=state.selectedHostAssets.filter(id=>state.holdings.some(h=>h.id===id));"
host_new = "state.holdings=s.docs.map(d=>({id:d.id,...d.data()})).filter(h=>h.archived!==true);state.selectedHostAssets=state.selectedHostAssets.filter(id=>state.holdings.some(h=>h.id===id));"
if host_new not in host:
    host = replace_once(host, host_old, host_new, "host active-holdings filter")
    write(host_rel, host)
else:
    print(f"already patched {host_rel}")

# 4) Firestore: immutable asset identity, deterministic tint variants, archive/restore-only owner lifecycle updates.
rules_rel = "logicalcommunicationservice/firestore.rules"
rules = read(rules_rel)

rules_old_asset = r'''    function validAssetHoldingEventType(value) { return value in ['market_acquire','migration','trade']; }
    function validAssetHolding(data) {
      return data.keys().hasOnly(['ownerProfileId','assetId','tint','acquiredAt','updatedAt','lastEventId','lastEventType'])
        && validPublicId(data.ownerProfileId) && profileExists(data.ownerProfileId)
        && validErasAssetId(data.assetId)
        && validAssetTint(data.tint)
        && data.acquiredAt is timestamp && data.updatedAt is timestamp
        && data.lastEventId is string && data.lastEventId.size() <= 180
        && validAssetHoldingEventType(data.lastEventType);
    }
    function validHoldingTradeUpdate(holdingId, data) {
      let settlementPath = /databases/$(database)/documents/tradeSettlements/$(data.lastEventId);
      return data.lastEventType == 'trade'
        && !exists(settlementPath) && existsAfter(settlementPath)
        && getAfter(settlementPath).data.initiatorProfileId == callerProfileId()
        && data.assetId == resource.data.assetId
        && data.tint == resource.data.tint
        && data.acquiredAt == resource.data.acquiredAt
        && ((holdingId == getAfter(settlementPath).data.initiatorHoldingId
            && resource.data.ownerProfileId == getAfter(settlementPath).data.initiatorProfileId
            && data.ownerProfileId == getAfter(settlementPath).data.recipientProfileId
            && data.assetId == getAfter(settlementPath).data.initiatorAssetId
            && data.tint == getAfter(settlementPath).data.initiatorAssetTint)
          || (holdingId == getAfter(settlementPath).data.recipientHoldingId
            && resource.data.ownerProfileId == getAfter(settlementPath).data.recipientProfileId
            && data.ownerProfileId == getAfter(settlementPath).data.initiatorProfileId
            && data.assetId == getAfter(settlementPath).data.recipientAssetId
            && data.tint == getAfter(settlementPath).data.recipientAssetTint));
    }
    match /assetHoldings/{holdingId} {
      allow read: if hasPrivateAccount() && resource.data.ownerProfileId == callerProfileId();
      allow create: if callerCanContribute()
        && request.resource.data.ownerProfileId == callerProfileId()
        && validAssetHolding(request.resource.data)
        && request.resource.data.lastEventType == 'market_acquire'
        && request.resource.data.lastEventId == ''
        && freeMarketplaceAssetId(request.resource.data.assetId)
        && holdingId == 'market__' + callerProfileId() + '__' + request.resource.data.assetId
        && request.resource.data.acquiredAt == request.time
        && request.resource.data.updatedAt == request.time;
      allow update: if validAssetHolding(request.resource.data)
        && request.resource.data.updatedAt == request.time
        && ((resource.data.ownerProfileId == callerProfileId()
            && request.resource.data.ownerProfileId == resource.data.ownerProfileId
            && request.resource.data.assetId == resource.data.assetId
            && request.resource.data.acquiredAt == resource.data.acquiredAt
            && request.resource.data.lastEventId == resource.data.lastEventId
            && request.resource.data.lastEventType == resource.data.lastEventType)
          || validHoldingTradeUpdate(holdingId, request.resource.data));
      allow delete: if false;
    }'''

rules_new_asset = r'''    function validAssetHoldingEventType(value) { return value in ['market_acquire','migration','trade']; }
    function marketplaceVariantAssetId(id) {
      // Add future marketplace assets here when their tint/property selection is
      // part of the immutable holding identity rather than a post-purchase edit.
      return id in ['eras:slime_monochrome'];
    }
    function marketplaceHoldingIdMatches(holdingId, data) {
      let baseId = 'market__' + callerProfileId() + '__' + data.assetId;
      return (marketplaceVariantAssetId(data.assetId) && holdingId == baseId + '__' + data.tint)
        || (!marketplaceVariantAssetId(data.assetId) && holdingId == baseId);
    }
    function validAssetHolding(data) {
      return data.keys().hasOnly(['ownerProfileId','assetId','tint','acquiredAt','updatedAt','lastEventId','lastEventType','archived','archivedAt'])
        && validPublicId(data.ownerProfileId) && profileExists(data.ownerProfileId)
        && validErasAssetId(data.assetId)
        && validAssetTint(data.tint)
        && data.acquiredAt is timestamp && data.updatedAt is timestamp
        && data.lastEventId is string && data.lastEventId.size() <= 180
        && validAssetHoldingEventType(data.lastEventType)
        && data.get('archived', false) is bool
        && validOptionalTimestamp(data.get('archivedAt', null))
        && ((data.get('archived', false) == true && data.get('archivedAt', null) is timestamp)
          || (data.get('archived', false) == false && data.get('archivedAt', null) == null));
    }
    function validHoldingArchiveUpdate(data) {
      return resource.data.ownerProfileId == callerProfileId()
        && data.ownerProfileId == resource.data.ownerProfileId
        && data.assetId == resource.data.assetId
        && data.tint == resource.data.tint
        && data.acquiredAt == resource.data.acquiredAt
        && data.lastEventId == resource.data.lastEventId
        && data.lastEventType == resource.data.lastEventType
        && data.diff(resource.data).affectedKeys().hasOnly(['archived','archivedAt','updatedAt'])
        && data.get('archived', false) != resource.data.get('archived', false)
        && ((data.get('archived', false) == true && data.get('archivedAt', null) == request.time)
          || (data.get('archived', false) == false && data.get('archivedAt', null) == null));
    }
    function validHoldingTradeUpdate(holdingId, data) {
      let settlementPath = /databases/$(database)/documents/tradeSettlements/$(data.lastEventId);
      return data.lastEventType == 'trade'
        && !exists(settlementPath) && existsAfter(settlementPath)
        && getAfter(settlementPath).data.initiatorProfileId == callerProfileId()
        && resource.data.get('archived', false) == false
        && data.get('archived', false) == false
        && data.get('archivedAt', null) == resource.data.get('archivedAt', null)
        && data.assetId == resource.data.assetId
        && data.tint == resource.data.tint
        && data.acquiredAt == resource.data.acquiredAt
        && ((holdingId == getAfter(settlementPath).data.initiatorHoldingId
            && resource.data.ownerProfileId == getAfter(settlementPath).data.initiatorProfileId
            && data.ownerProfileId == getAfter(settlementPath).data.recipientProfileId
            && data.assetId == getAfter(settlementPath).data.initiatorAssetId
            && data.tint == getAfter(settlementPath).data.initiatorAssetTint)
          || (holdingId == getAfter(settlementPath).data.recipientHoldingId
            && resource.data.ownerProfileId == getAfter(settlementPath).data.recipientProfileId
            && data.ownerProfileId == getAfter(settlementPath).data.initiatorProfileId
            && data.assetId == getAfter(settlementPath).data.recipientAssetId
            && data.tint == getAfter(settlementPath).data.recipientAssetTint));
    }
    match /assetHoldings/{holdingId} {
      allow read: if hasPrivateAccount() && resource.data.ownerProfileId == callerProfileId();
      allow create: if callerCanContribute()
        && request.resource.data.ownerProfileId == callerProfileId()
        && validAssetHolding(request.resource.data)
        && request.resource.data.keys().hasAll(['archived','archivedAt'])
        && request.resource.data.lastEventType == 'market_acquire'
        && request.resource.data.lastEventId == ''
        && freeMarketplaceAssetId(request.resource.data.assetId)
        && marketplaceHoldingIdMatches(holdingId, request.resource.data)
        && request.resource.data.archived == false
        && request.resource.data.archivedAt == null
        && request.resource.data.acquiredAt == request.time
        && request.resource.data.updatedAt == request.time;
      allow update: if validAssetHolding(request.resource.data)
        && request.resource.data.updatedAt == request.time
        && (validHoldingArchiveUpdate(request.resource.data)
          || validHoldingTradeUpdate(holdingId, request.resource.data));
      allow delete: if false;
    }'''

if rules_new_asset not in rules:
    rules = replace_once(rules, rules_old_asset, rules_new_asset, "asset holding immutability/archive rules")

trade_owned_old = r'''    function tradeHoldingOwnedAndMatches(profileId, holdingId, assetId, tint) {
      let safeHoldingId = holdingId == '' ? '__none__' : holdingId;
      let holdingPath = /databases/$(database)/documents/assetHoldings/$(safeHoldingId);
      return holdingId == ''
        || (exists(holdingPath)
          && get(holdingPath).data.ownerProfileId == profileId
          && get(holdingPath).data.assetId == assetId
          && get(holdingPath).data.tint == tint);
    }'''
trade_owned_new = r'''    function tradeHoldingOwnedAndMatches(profileId, holdingId, assetId, tint) {
      let safeHoldingId = holdingId == '' ? '__none__' : holdingId;
      let holdingPath = /databases/$(database)/documents/assetHoldings/$(safeHoldingId);
      return holdingId == ''
        || (exists(holdingPath)
          && get(holdingPath).data.ownerProfileId == profileId
          && get(holdingPath).data.get('archived', false) == false
          && get(holdingPath).data.assetId == assetId
          && get(holdingPath).data.tint == tint);
    }'''
if trade_owned_new not in rules:
    rules = replace_once(rules, trade_owned_old, trade_owned_new, "trade rejects archived holdings")

settle_old = r'''    function tradeSettlementHoldingValid(holdingId, ownerBefore, ownerAfter, assetId, tint, tradeId) {
      let safeId = holdingId == '' ? '__none_settlement__' : holdingId;
      let path = /databases/$(database)/documents/assetHoldings/$(safeId);
      return holdingId == '' || (exists(path) && existsAfter(path)
        && get(path).data.ownerProfileId == ownerBefore
        && get(path).data.assetId == assetId && get(path).data.tint == tint
        && getAfter(path).data.ownerProfileId == ownerAfter
        && getAfter(path).data.assetId == assetId && getAfter(path).data.tint == tint
        && getAfter(path).data.lastEventId == tradeId && getAfter(path).data.lastEventType == 'trade');
    }'''
settle_new = r'''    function tradeSettlementHoldingValid(holdingId, ownerBefore, ownerAfter, assetId, tint, tradeId) {
      let safeId = holdingId == '' ? '__none_settlement__' : holdingId;
      let path = /databases/$(database)/documents/assetHoldings/$(safeId);
      return holdingId == '' || (exists(path) && existsAfter(path)
        && get(path).data.ownerProfileId == ownerBefore
        && get(path).data.get('archived', false) == false
        && get(path).data.assetId == assetId && get(path).data.tint == tint
        && getAfter(path).data.ownerProfileId == ownerAfter
        && getAfter(path).data.get('archived', false) == false
        && getAfter(path).data.get('archivedAt', null) == get(path).data.get('archivedAt', null)
        && getAfter(path).data.assetId == assetId && getAfter(path).data.tint == tint
        && getAfter(path).data.lastEventId == tradeId && getAfter(path).data.lastEventType == 'trade');
    }'''
if settle_new not in rules:
    rules = replace_once(rules, settle_old, settle_new, "trade settlement preserves active archive state")

offer_old = r'''    function offerHoldingOwned(holdingId, sellerProfileId) {
      let p = /databases/$(database)/documents/assetHoldings/$(holdingId);
      return holdingId is string && holdingId.size() >= 8 && holdingId.size() <= 180
        && exists(p) && get(p).data.ownerProfileId == sellerProfileId;
    }'''
offer_new = r'''    function offerHoldingOwned(holdingId, sellerProfileId) {
      let p = /databases/$(database)/documents/assetHoldings/$(holdingId);
      return holdingId is string && holdingId.size() >= 8 && holdingId.size() <= 180
        && exists(p) && get(p).data.ownerProfileId == sellerProfileId
        && get(p).data.get('archived', false) == false;
    }'''
if offer_new not in rules:
    rules = replace_once(rules, offer_old, offer_new, "hosted offers reject archived holdings")

hosted_update_old = r'''      allow update: if callerCanContribute()
        && resource.data.sellerProfileId == callerProfileId()
        && request.resource.data.sellerProfileId == resource.data.sellerProfileId
        && request.resource.data.lobbyId == resource.data.lobbyId
        && request.resource.data.offerType == resource.data.offerType
        && request.resource.data.createdAt == resource.data.createdAt
        && request.resource.data.updatedAt == request.time
        && validHostedOffer(request.resource.data);'''
hosted_update_new = r'''      allow update: if callerCanContribute()
        && resource.data.sellerProfileId == callerProfileId()
        && request.resource.data.sellerProfileId == resource.data.sellerProfileId
        && request.resource.data.lobbyId == resource.data.lobbyId
        && request.resource.data.offerType == resource.data.offerType
        && request.resource.data.createdAt == resource.data.createdAt
        && request.resource.data.updatedAt == request.time
        && (validHostedOffer(request.resource.data)
          || (resource.data.active == true
            && request.resource.data.active == false
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['active','updatedAt'])));'''
if hosted_update_new not in rules:
    rules = replace_once(rules, hosted_update_old, hosted_update_new, "allow cleanup/deactivation of offers after archive")

host_ref_old = r'''    function validHostAssetRef(asset, hostProfileId) {
      let p = /databases/$(database)/documents/assetHoldings/$(asset.holdingId);
      return asset is map && asset.keys().hasOnly(['holdingId','assetId','tint'])
        && asset.holdingId is string && asset.holdingId.size() >= 8 && asset.holdingId.size() <= 180
        && asset.assetId is string && validAssetTint(asset.tint)
        && exists(p) && get(p).data.ownerProfileId == hostProfileId
        && get(p).data.assetId == asset.assetId && get(p).data.tint == asset.tint;
    }'''
host_ref_new = r'''    function validHostAssetRef(asset, hostProfileId) {
      let p = /databases/$(database)/documents/assetHoldings/$(asset.holdingId);
      return asset is map && asset.keys().hasOnly(['holdingId','assetId','tint'])
        && asset.holdingId is string && asset.holdingId.size() >= 8 && asset.holdingId.size() <= 180
        && asset.assetId is string && validAssetTint(asset.tint)
        && exists(p) && get(p).data.ownerProfileId == hostProfileId
        && get(p).data.get('archived', false) == false
        && get(p).data.assetId == asset.assetId && get(p).data.tint == asset.tint;
    }'''
if host_ref_new not in rules:
    rules = replace_once(rules, host_ref_old, host_ref_new, "host lobbies reject archived holdings")

write(rules_rel, rules)

print("\nE.R.A.S. immutable asset variants + recoverable Asset Archive patch applied.")
print("Deploy logicalcommunicationservice/firestore.rules before relying on backend enforcement.")
