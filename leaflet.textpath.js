/* eslint-disable no-undef */
/* eslint-disable object-shorthand */
/*
 * Leaflet.TextPath - Shows text along a polyline
 * Inspired by Tom Mac Wright article :
 * http://mapbox.com/osmdev/2012/11/20/getting-serious-about-svg/
 */

(function() {
	const __bringToBack = L.Polyline.prototype.bringToBack;
	const __bringToFront = L.Polyline.prototype.bringToFront;
	const __onAdd = L.Polyline.prototype.onAdd;
	const __onRemove = L.Polyline.prototype.onRemove;
	const __updatePath = L.Polyline.prototype._updatePath;

	const PolylineTextPath = {
		mutationObserver: null,
		_textOpacity: null,

		bringToBack: function() {
			__bringToBack.call(this);
			this._textRedraw();

			return this;
		},
		bringToFront: function() {
			__bringToFront.call(this);
			this._textRedraw();

			return this;
		},

		onAdd: function(map) {
			this.mutationObserver = new MutationObserver((mutationList, observer) => {
				if (!(SVGPathEditor && typeof SVGPathEditor.reverse === 'function')) {
					return;
				}
				if (!this._textNode) {
					return;
				}
				if (!this._textNode.firstChild) {
					return;
				}

				for(let mutation of mutationList) {
					if (mutation.type !== 'childList') {
						continue;
					}

					for(const removedNode of mutation.removedNodes) {
						if (removedNode.nodeName !== 'path') {
							continue;
						}
						if (!removedNode.id) {
							continue;
						}
						if (removedNode.id.indexOf('pathdef-') !== 0) {
							continue;
						}

						const reversedId = `${removedNode.id}-reversed`;
						const reversedElement = document.getElementById(reversedId);
						if (!reversedElement) {
							continue;
						}

						reversedElement.parentElement.removeChild(reversedElement);
					}
				}
			});
			this.mutationObserver.observe(document.body, {
				childList: true,
				subtree: true
			});

			__onAdd.call(this, map);
			this._textRedraw();

			return this;
		},

		onRemove: function(map) {
			const currentMap = map || this._map;
			if (currentMap && this._textNode && this._textNode.parentNode && currentMap._renderer._container) {
				// currentMap._renderer._container.removeChild(this._textNode);
				this._textNode.parentNode.removeChild(this._textNode);
			}
			__onRemove.call(this, currentMap);

			return this;
		},

		_updatePath: function() {
			if (!this._renderer) {
				return;
			}
			__updatePath.call(this);
			this._textRedraw();
		},

		_textRedraw: function() {
			const text = this._text;
			const options = this._textOptions;
			if (text) {
				this.setText(null).setText(text, options);
			}
		},

		getTextElement: function() {
			return this._textNode;
		},

		getText: function() {
			return this;
		},

		setText: function(text, options) {
			this._text = text;
			this._textOptions = options;

			// If not in SVG mode or Polyline not added to map yet return
			// setText will be called by onAdd, using value stored in this._text
			if (!L.Browser.svg || this._map === undefined || this._map === null) {
				return this;
			}

			const defaults = {
				repeat: false,
				fillColor: 'black',
				attributes: {},
				below: false,
				above: false
			};
			// eslint-disable-next-line no-param-reassign
			options = L.Util.extend(defaults, options);

			// If empty text, hide
			if (!text) {
				if (this._textNode && this._textNode.parentNode) {
					// this._map._renderer._container.removeChild(this._textNode);
					this._textNode.parentNode.removeChild(this._textNode);
					// delete the node, so it will not be removed a 2nd time if the layer is later removed from the map
					delete this._textNode;
				}
				return this;
			}

			// Non breakable spaces
			// eslint-disable-next-line no-param-reassign
			text = text.replace(/ /g, '\u00A0');
			const id = `pathdef-${L.Util.stamp(this)}`;
			const svg = this._map._renderer._container;
			this._path.setAttribute('id', id);

			if (options.repeat) {
				// Compute single pattern length
				const pattern = L.SVG.create('text');
				for(const attr in options.attributes) {
					pattern.setAttribute(attr, options.attributes[attr]);
				}
				pattern.appendChild(document.createTextNode(text));
				svg.appendChild(pattern);
				const alength = pattern.getComputedTextLength();
				svg.removeChild(pattern);

				// Create string as long as path
				// eslint-disable-next-line no-param-reassign
				text = new Array(Math.ceil(isNaN(this._path.getTotalLength() / alength) ? 0 : this._path.getTotalLength() / alength)).join(text);
			}

			// Put it along the path using textPath
			const textNode = L.SVG.create('text');
			const textPath = L.SVG.create('textPath');

			const dy = options.offset || this._path.getAttribute('stroke-width');

			textNode.setAttribute('data-ref-id', id);

			textPath.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `#${id}`);

			let reversedPathElement = document.getElementById(`${id}-reversed`);
			if (reversedPathElement) {
				reversedPathElement.parentNode.removeChild(reversedPathElement);
			}
			if (options.orientation === 'reverse') {
				if (SVGPathEditor && typeof SVGPathEditor.reverse === 'function') {
					// eslint-disable-next-line no-param-reassign
					options.orientation = 0;
					const pathElement = document.getElementById(id);
					if (pathElement) {
						const dAttr = pathElement.attributes.getNamedItem('d');
						if (dAttr) {
							const d = dAttr.value;
							const dReversed = SVGPathEditor.reverse(d);
							reversedPathElement = pathElement.cloneNode(true);
							reversedPathElement.setAttribute('d', dReversed);
							reversedPathElement.setAttribute('id', `${id}-reversed`);
							reversedPathElement.setAttribute('stroke-opacity', '0');
							pathElement.parentNode.insertBefore(reversedPathElement, pathElement);
							textPath.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `#${id}-reversed`);
						} else {
							console.warn('d-attribute doesn\'t exists!');
						}
					} else {
						// console.warn('path-element with id "' + id + '" doesn\'t exists!');
					}
				} else {
					console.warn('SVGPathEditor is not available (see: https://github.com/Pomax/svg-path-reverse). Fallback to flipping the text!');
					// eslint-disable-next-line no-param-reassign
					options.orientation = 'flip';
				}
			}

			if (this._textZIndex !== undefined && this._textZIndex !== null) {
				textNode.setAttribute('data-z-index', this._textZIndex);
			}
			textNode.setAttribute('dy', dy);
			for(const attr in options.attributes) {
				textNode.setAttribute(attr, options.attributes[attr]);
			}
			textPath.appendChild(document.createTextNode(text));
			textNode.appendChild(textPath);
			if (this._textNode && this._textNode.parentNode) {
				this._textNode.parentNode.removeChild(this._textNode);
			}
			this._textNode = textNode;

			if (options.below) {
				svg.insertBefore(textNode, svg.firstChild);
			} else if (options.above) {
				const refElement = document.getElementById(id);
				if (refElement) {
					if (refElement.nextSibling) {
						refElement.parentNode.insertBefore(textNode, refElement.nextSibling);
					} else {
						refElement.parentNode.appendChild(textNode);
					}
				} else {
					console.warn(`unable to find ref-element (${id}) for text-path!`);
				}
			} else {
				let textOverlayGroup = svg.querySelector('g.text-overlay');
				if (!textOverlayGroup) {
					textOverlayGroup = L.SVG.create('g');
					textOverlayGroup.setAttribute('class', 'text-overlay');
					svg.appendChild(textOverlayGroup);
				}
				textOverlayGroup.appendChild(textNode);
			}

			// Center text according to the path's bounding box
			if (options.center) {
				const textLength = textNode.getComputedTextLength();
				const pathLength = this._path.getTotalLength();
				// Set the position for the left side of the textNode
				textNode.setAttribute('dx', ((pathLength / 2) - (textLength / 2)));
			}

			// Change label rotation (if required)
			if (options.orientation) {
				let rotateAngle = 0;
				switch(options.orientation) {
					case 'reverse':
						break;
					case 'flip':
						rotateAngle = 180;
						break;
					case 'perpendicular':
						rotateAngle = 90;
						break;
					default:
						rotateAngle = options.orientation;
				}

				const rotatecenterX = (textNode.getBBox().x + textNode.getBBox().width / 2);
				const rotatecenterY = (textNode.getBBox().y + textNode.getBBox().height / 2);
				textNode.setAttribute('transform', `rotate(${rotateAngle} ${rotatecenterX} ${rotatecenterY})`);
			}

			// Initialize mouse events for the additional nodes
			if (this.options.interactive) {
				if (L.Browser.svg || !L.Browser.vml) {
					textPath.setAttribute('class', 'leaflet-interactive');
				}

				if (this._events) {
					const inheritableEvents = ['mouseover', 'mouseout'];
					for(const inheritableEvent of inheritableEvents) {
						const events = this._events[inheritableEvent];
						if (events && events instanceof Array) {
							for(const event of events) {
								L.DomEvent.on(textNode, inheritableEvent, event.fn, event.ctx);
							}
						}
					}
				}

				if (this._popup) {
					L.DomEvent.on(textNode, 'click', evt => {
						let latLng;
						if (this._map) {
							latLng = this._map.containerPointToLatLng([evt.clientX, evt.clientY]);
						}
						setTimeout(() => {
							this.openPopup(latLng);
						}, 1);
					});
				}

				const events = ['click', 'dblclick', 'mousedown', 'mouseover', 'mouseout', 'mousemove', 'contextmenu'];
				for(let i = 0; i < events.length; i++) {
					L.DomEvent.on(textNode, events[i], this.fire, this);
				}
			}

			this._checkTextZIndex();

			if (this._textOpacity !== null) {
				this._textNode.style.opacity = this._textOpacity;
			}

			return this;
		},

		setTextOpacity(opacity) {
			this._textOpacity = opacity;
			if (this._textNode) {
				this._textNode.style.opacity = opacity;
			}
		},

		getTextZIndex: function() {
			return this._textZIndex;
		},

		setTextZIndex: function(zIndex) {
			this._textZIndex = zIndex;

			return this;
		},

		_checkTextZIndex() {
			if (!this._textOptions) {
				return;
			}
			if (this._textOptions.above || this._textOptions.below) {
				return;
			}

			if (!this._textNode) {
				return;
			}
			const dataZIndexAttr = this._textNode.attributes.getNamedItem('data-z-index');
			if (!dataZIndexAttr) {
				return;
			}

			const zIndex = parseInt(dataZIndexAttr.value);
			if (isNaN(zIndex)) {
				return;
			}

			if (!this._map) {
				return;
			}
			if (!this._map._renderer) {
				return;
			}
			if (!this._map._renderer._container) {
				return;
			}

			const svg = this._map._renderer._container;
			const textsWithZIndex = svg.querySelectorAll('g.text-overlay > text[data-z-index]');
			for(const textWithZIndex of textsWithZIndex) {
				const zIndexAttr = textWithZIndex.attributes.getNamedItem('data-z-index');
				if (!zIndexAttr) {
					continue;
				}
				const currentZIndex = parseInt(zIndexAttr.value);
				if (isNaN(currentZIndex)) {
					continue;
				}

				if (currentZIndex > zIndex) {
					textWithZIndex.parentNode.insertBefore(this._textNode, textWithZIndex);
					break;
				}
			}
		}
	};

	L.Polyline.include(PolylineTextPath);

	L.LayerGroup.include({
		setText: function(text, options) {
			for(const layer in this._layers) {
				if (typeof this._layers[layer].setText === 'function') {
					this._layers[layer].setText(text, options);
				}
			}
			return this;
		}
	});
})();
