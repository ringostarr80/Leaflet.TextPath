/*
 * Leaflet.TextPath - Shows text along a polyline
 * Inspired by Tom Mac Wright article :
 * http://mapbox.com/osmdev/2012/11/20/getting-serious-about-svg/
 */

(function () {
    const __onAdd = L.Polyline.prototype.onAdd;
    const __onRemove = L.Polyline.prototype.onRemove;
    const __updatePath = L.Polyline.prototype._updatePath;
    const __bringToFront = L.Polyline.prototype.bringToFront;

    const PolylineTextPath = {
        onAdd: function (map) {
            __onAdd.call(this, map);
            this._textRedraw();
        },

        onRemove: function (map) {
            map = map || this._map;
            if (map && this._textNode && map._renderer._container) {
                map._renderer._container.removeChild(this._textNode);
            }
            __onRemove.call(this, map);
        },

        bringToFront: function () {
            __bringToFront.call(this);
            this._textRedraw();
        },

        _updatePath: function () {
            __updatePath.call(this);
            this._textRedraw();
        },

        _textRedraw: function () {
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

        setText: function (text, options) {
            this._text = text;
            this._textOptions = options;

            /* If not in SVG mode or Polyline not added to map yet return */
            /* setText will be called by onAdd, using value stored in this._text */
            if (!L.Browser.svg || typeof this._map === 'undefined') {
                return this;
            }

            const defaults = {
                repeat: false,
                fillColor: 'black',
                attributes: {},
                below: false,
            };
            options = L.Util.extend(defaults, options);

            /* If empty text, hide */
            if (!text) {
                if (this._textNode && this._textNode.parentNode) {
                    this._map._renderer._container.removeChild(this._textNode);
                    
                    /* delete the node, so it will not be removed a 2nd time if the layer is later removed from the map */
                    delete this._textNode;
                }
                return this;
            }

            text = text.replace(/ /g, '\u00A0');  // Non breakable spaces
            const id = 'pathdef-' + L.Util.stamp(this);
            const svg = this._map._renderer._container;
            this._path.setAttribute('id', id);

            if (options.repeat) {
                /* Compute single pattern length */
                const pattern = L.SVG.create('text');
                for(const attr in options.attributes) {
                    pattern.setAttribute(attr, options.attributes[attr]);
                }
                pattern.appendChild(document.createTextNode(text));
                svg.appendChild(pattern);
                const alength = pattern.getComputedTextLength();
                svg.removeChild(pattern);

                /* Create string as long as path */
                text = new Array(Math.ceil(isNaN(this._path.getTotalLength() / alength) ? 0 : this._path.getTotalLength() / alength)).join(text);
            }

            /* Put it along the path using textPath */
            const textNode = L.SVG.create('text');
            const textPath = L.SVG.create('textPath');

            const dy = options.offset || this._path.getAttribute('stroke-width');

            textPath.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", '#' + id);
            textNode.setAttribute('dy', dy);
            for(const attr in options.attributes) {
                textNode.setAttribute(attr, options.attributes[attr]);
            }
            textPath.appendChild(document.createTextNode(text));
            textNode.appendChild(textPath);
            this._textNode = textNode;

            if (options.below) {
                svg.insertBefore(textNode, svg.firstChild);
            }
            else {
                svg.appendChild(textNode);
            }

            /* Center text according to the path's bounding box */
            if (options.center) {
                const textLength = textNode.getComputedTextLength();
                const pathLength = this._path.getTotalLength();
                /* Set the position for the left side of the textNode */
                textNode.setAttribute('dx', ((pathLength / 2) - (textLength / 2)));
            }

            /* Change label rotation (if required) */
            if (options.orientation) {
                let rotateAngle = 0;
                switch (options.orientation) {
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
                textNode.setAttribute('transform','rotate(' + rotateAngle + ' '  + rotatecenterX + ' ' + rotatecenterY + ')');
            }

            /* Initialize mouse events for the additional nodes */
            if (this.options.interactive) {
                if (L.Browser.svg || !L.Browser.vml) {
                    textPath.setAttribute('class', 'leaflet-interactive');
                }

                const events = ['click', 'dblclick', 'mousedown', 'mouseover', 'mouseout', 'mousemove', 'contextmenu'];
                for(let i = 0; i < events.length; i++) {
                    L.DomEvent.on(textNode, events[i], this.fire, this);
                }
            }

            return this;
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
