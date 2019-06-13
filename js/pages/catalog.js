"use strict"

pageInit.catalog = function() {
	if(settings.general.robuxToUSD) {
		modifyTemplate("catalog-item-card", template => {
			const label = template.$find(".item-card-price")
			if(!label) { return }
			label.style.display = "flex"

			const div = html`<div style="flex:1 0 auto"></div>`
			while(label.firstChild) { div.append(label.firstChild) }

			label.append(div)
			const text = `($\{{::(((item.BestPrice||item.Price)*${GetRobuxRatio()[0]})/${GetRobuxRatio()[1]})|number:2}})`
			label.title = `{{::item.IsFree && "Free " || "R$ "}}{{::(item.BestPrice||item.Price)|number:0}} ${text}`
			label.append(html`
			<div style="flex:0 1 auto;padding-left:4px;overflow:hidden;text-overflow:ellipsis;" ng-if=item.BestPrice||item.Price class=text-robux ng-cloak> ${text}</div>
			`)
		})
	}

	if(settings.general.hoverPreview) {
		HoverPreview.register(".item-card", ".item-card-thumb-container")
	}

	if(!settings.catalog.enabled) { return }
	const bodyWatcher = document.$watch("body", body => body.classList.add("btr-catalog")).$then()

	bodyWatcher.$watch("#catalog-content", cat => {
		cat.classList.add("section-content")
	})

	modifyTemplate("item-card", template => {
		const cont = template.$find(".item-card-container")
		cont.classList.add("btr-item-card-container")
		cont.setAttribute("btr-item-type", "{{item.ItemType}}")

		const hover = html`<div class="btr-item-card-more">
			<div class=text-secondary>
				<div class="text-overflow item-card-label" ng-if="item.ItemType===1">Updated: <span class=btr-updated-label>Loading...</span></div>
				<div class="text-overflow item-card-label" ng-if="item.ItemType===1||item.ItemType===2">Sales: <span class=btr-sales-label>Loading...</span></div>
				<div class="text-overflow item-card-label" ng-if="!item.Creator">By <span class="text-link creator-name" ng-click="creatorClick($event, 'https://www.roblox.com/users/1/profile')">ROBLOX</span></div>
			</div>
		</div>`
		hover.append(template.$find(".creator-name").parentNode)
		template.$find(".item-card-caption").append(hover)
	})

	document.$on("mouseover", ".btr-item-card-container", ev => {
		const self = ev.currentTarget

		const matches = self.closest("a").href.match(/\/(catalog|bundles)\/(\d+)\//, "$1")
		if(!matches) { return }

		const assetType = matches[1]
		const assetId = matches[2]
		if(!Number.isSafeInteger(+assetId)) { return }

		if(assetType === "bundles") {
			$.fetch(`https://catalog.roblox.com/v1/catalog/items`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					items: [{
						itemType: "Bundle",
						id: assetId
					}]
				}),
				xsrf: true
			}).then(async resp => {
				if(!resp.ok) { return }
				const data = await resp.json()

				const slabel = self.$find(".btr-sales-label")
				slabel.textContent = FormatNumber(data.data[0].purchaseCount)
				slabel.parentNode.title = slabel.parentNode.textContent
			})
		} else {
			getProductInfo(assetId).then(data => {
				const ulabel = self.$find(".btr-updated-label")
				ulabel.textContent = `${$.dateSince(data.Updated, startDate)} ago`
				ulabel.parentNode.title = ulabel.parentNode.textContent
	
				const slabel = self.$find(".btr-sales-label")
				slabel.textContent = FormatNumber(data.Sales)
				slabel.parentNode.title = slabel.parentNode.textContent
			})
		}
	})

	if(settings.catalog.showOwnedAssets) {
		const ownedRequestList = []
		const listeners = {}

		const updateAssetsOwned = assetsOwned => {
			Object.entries(assetsOwned).forEach(([id, isOwned]) => {
				const list = listeners[id]
				if(list) {
					for(let i = list.length; i--;) {
						const { elem, fn } = list[i]

						if(document.body.contains(elem)) {
							fn(isOwned)
						} else {
							list.splice(i, 1)
						}
					}

					if(!list.length) {
						delete listeners[id]
					}
				}
			})
		}

		const getIsAssetOwned = (id, elem, fn) => {
			if(!ownedRequestList.length) {
				$.setImmediate(() => {
					const list = ownedRequestList.splice(0, ownedRequestList.length)
					MESSAGING.send("filterOwnedAssets", list, updateAssetsOwned)
				})
			}

			ownedRequestList.push(id)

			if(!listeners[id]) { listeners[id] = [] }
			listeners[id].push({ elem, fn })
		}

		const hookItem = item => {
			item.$watch(["a", ".item-card-thumb-container"], (anchor, thumb) => {
				const match = anchor.href.match(/\/(catalog|library|bundles)\/(\d+)/)
				if(!match) { return console.log("bad", anchor) }

				const id = match[1] === "bundles" ? "bundle_" + match[2] : match[2]
				let ownedLabel

				getIsAssetOwned(id, anchor, isOwned => {
					if(isOwned) {
						if(!ownedLabel) {
							ownedLabel = html`<span class=btr-item-owned style="position:absolute;bottom:-2px;right:-2px;z-index:1000;width:34px;height:34px;background:#02b757;border-radius:50%;transform:scale(.55);display:flex;align-items:center;justify-content:center;"><span class=icon-checkmark-white-bold title="You own this item" style="bottom:auto;left:auto;"></span></span>`
						}

						thumb.append(ownedLabel)
					} else if(ownedLabel) {
						ownedLabel.remove()
					}
				})
			})
		}
		
		bodyWatcher.$watch(".catalog-results").$then()
			.$watchAll("div", page => {
				if(page.matches("#results")) {
					page.$watch(".hlist").$then()
						.$watchAll(".list-item", hookItem)
				} else if(page.matches("div[landing-page")) {
					page.$watchAll("div", par =>
						par.$watch(".hlist").$then()
							.$watchAll(".list-item", hookItem)
					)
				}
			})
	}
}