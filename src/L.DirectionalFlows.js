/**
 * class L.DirectionalFlows()
 * 
 * (extends L.GeoJSON)
 * 
 * <DESCRIPTION>
 * 
 */

var L = require("leaflet");
var arrowheads = require("leaflet-arrowheads");
var chroma = require("chroma-js");


L.DirectionalFlows = L.GeoJSON.extend({
    options: {
        //data: null,
        attributes: {},
        style: {},
        colors: ["white", "darkblue"],
        classes: 10,
        mode: 'e',
    },

    // variables for plugin scope
    _defaultAttributes: {
        id: "id",
        forwardsvolume: "forwardsvolume",
        backwardsvolume: "backwardsvolume",
    },
    _defaultStyle: {
        weight: 3,
        arrowWeight: 5,
        opacity: 1.0,        
    },
    _selectedIds: [],
    _colors: null,
    _limits: null,

    // functions
    onAdd: function(map) {
        L.GeoJSON.prototype.onAdd.call(this, map);
        this.createArcs();
        this.setStyle();
    },

    createArcs: function(){
        let arcs = [];
        let layers = this._layers;
        let attributes = this.options.attributes;
        let numPoints = 50;

        for (let i in layers){
            let layer = layers[i];
            let id = layer.feature.properties[attributes.id];
            let forwardsvolume = layer.feature.properties[attributes.forwardsvolume];
            let backwardsvolume = layer.feature.properties[attributes.backwardsvolume];
            
            let coordinates = layer.feature.geometry.coordinates;
            // First coordinate
            let start = coordinates[0];
            start = {x:start[0], y:start[1]};
            // Last coordinate
            let end = coordinates[coordinates.length - 1];
            end = {x:end[0], y:end[1]};

            // Create separation between line segments
            let newCoordinates = this._newCoordinates(start, end, 10);
            start = newCoordinates["newPoint1"];
            end = newCoordinates["newPoint2"];

            // forward arc
            let { centerX, centerY, a, b, rotation } = this._calculateEllipseParams(start, end);
            let points = this._calculateEllipsePoints(centerX, centerY, a, b, rotation, numPoints, 1);
            let coords = []
            for (let i in points){
                let point = points[i];
                coords.push([point["y"], point["x"]])
            }

            link = L.polyline(coords);
            link["properties"] = {
                "id": id,
                "type": "forwardsvolume",
                "value": forwardsvolume,
            };
            arcs.push(link);

            // backward arc
            points = this._calculateEllipsePoints(centerX, centerY, a, b, rotation, numPoints, -1);
            coords = []
            for (let i in points){
                let point = points[i];
                coords.unshift([point["y"], point["x"]])
            }
            link = L.polyline(coords);
            link["properties"] = {
                "id": id,
                "type": "backwardsvolume",
                "value": backwardsvolume,
            };
            arcs.push(link);
        }

        // remove original geometry
        for (let i in layers){
            layers[i].remove();
            delete(layers[i]); 
        }

        // add new geometries to the map
        for (let i in arcs){
            arcs[i].addTo(this);
        }
    },

    setStyle: function () {
        this._validateAttributes();
        this._validateStyles();
        this._generateColors();

        let layers = this._layers;
        let style = this.options.style;
        for (let key in layers){
            let layer = layers[key];
            let id = layer.properties["id"]; 
            let value = layer.properties["value"];            
            
            let styleCopy = Object.assign({}, style);
            if (value == 0) styleCopy.weight = 0;

            let color = this._getColor(value);
            styleCopy.color = color;
            //styleCopy.weight = weight;

            if (value > 0){
                layer.arrowheads({
                    yawn: 70,
                    fill: true,
                    frequency: 'endonly',
                    size:  styleCopy.arrowWeight + 'px',
                    color: color,
                });
            }
            layer.setStyle(styleCopy); 
        }

        this._map.fitBounds(this._map.getBounds());
    },

    _validateAttributes: function() {
        let attributes = this.options.attributes;
        if (attributes == null | attributes == undefined) attributes = Object.assign({}, this._defaultAttributes);
        else {
            for (let key in this._defaultAttributes){
                if (!(key in attributes)) attributes[key] = this._defaultAttributes[key];
            }
        }
    },

    _validateStyles: function() {
        let style = this.options.style;
        if (typeof(style.colorSelected) == "string") style.colorSelected = [style.colorSelected]

        if (style == null | style == undefined) style = Object.assign({}, this._defaultStyle);
        else {
            for (let key in this._defaultStyle){
                if (!(key in style)) style[key] = this._defaultStyle[key];
            }
        }
    },

    /*updateData: function(data) {
        this.options.data = data;
        this.setStyle();
    },*/

    updateStyle: function(style){
        this.options.style = style;
        this.setStyle();
    },

    /*updateAttributes: function(attributes){
        this.options.attributes = attributes;
        this.setStyle();
    },*/

    /*selectFeature: function(id, clear=false) {
        if (clear) this.clearSelection();
        if (this._selectedIds.indexOf(id) == -1) {this._selectedIds.push(id)};

        this.setStyle();
    },

    unselectFeature: function(id) {
        const index = this._selectedIds.indexOf(id);
        if (index == -1) this._selectedIds.splice(index, 1);

        this.setStyle();
    },

    clearSelection: function() {
        delete(this._selectedIds);
        this._selectedIds = [];

        this.setStyle();
    },

    getSelected: function() {
        let selection = {};
        let style = this.options.style;

        for (i in this._selectedIds) {
            let item = this._selectedIds[i];
            let index = this._selectedIds.indexOf(item);
            index = index % style.colorSelected.length;
            selection[item] = style.colorSelected[index]; 
        }

        return selection;
    },*/

    _newCoordinates: function(point1, point2, percentage){
        // Calculate the vector from point1 to point2
        let dx = point2.x - point1.x;
        let dy = point2.y - point1.y;
    
        // Calculate the length of the vector
        let length = Math.sqrt(dx * dx + dy * dy);
    
        // Calculate the scale factor (90% of the original length)
        let scale = (1 - percentage / 100);
    
        // Calculate the new points along the same line
        let newPoint1 = {
            x: point1.x + (dx * (1 - scale) / 2),
            y: point1.y + (dy * (1 - scale) / 2)
        };
        let newPoint2 = {
            x: point2.x - (dx * (1 - scale) / 2),
            y: point2.y - (dy * (1 - scale) / 2)
        };
    
        return { newPoint1, newPoint2 };
    },

    _calculateEllipsePoints: function(centerX, centerY, a, b, rotation, numPoints, direction) {
        let points = [];
        for (let i = 5; i < numPoints-5; i++) {
            let t = direction * (i / (numPoints - 1)) * Math.PI;
            let x = a * Math.cos(t);
            let y = b * Math.sin(t);

            // Rotate the point (x, y) by the given rotation angle
            let rotatedX = x * Math.cos(rotation) - y * Math.sin(rotation);
            let rotatedY = x * Math.sin(rotation) + y * Math.cos(rotation);

            // Translate the point to the center
            points.push({ x: centerX + rotatedX, y: centerY + rotatedY });
        }
        return points;
    },

    _calculateEllipseParams: function(point1, point2) {
        let centerX = (point1.x + point2.x) / 2;
        let centerY = (point1.y + point2.y) / 2;
        let dx = point2.x - point1.x;
        let dy = point2.y - point1.y;
        let a = Math.sqrt(dx * dx + dy * dy) / 2;
        let b = a / 4;
        let rotation = Math.atan2(dy, dx);
        return { centerX, centerY, a, b, rotation };
    },

    _getColor(value) {
        let i = 0;
        while ((value > this._limits[i]) && ((i+2) < this._limits.length)) {
            i++;
        }
        return this._colors[i];
    },

    _generateColors: function() {
        let options = this.options
        let attributes = this.options.attributes;
        let values = [];

        let layers = this._layers;
        for (let key in layers) {
            let layer = layers[key];
            let value = layer.properties["value"];
            values.push(value);
        }

        if (options.symetric) {
            let min = Math.min(...values);
            let max = Math.max(...values);

            if ((min < 0) && (max > 0)){
                if (Math.abs(min) > Math.abs(max)) values.push(Math.abs(min));
                else values.push(-1 * max)
            }
        }

        this._colors = chroma.scale(options.colors).colors(options.classes);
        this._limits = chroma.limits(values, options.mode, options.classes);
    },
});

L.directionalFlows = function (geojson, options) {
    return new L.DirectionalFlows(geojson, options);
}

module.exports = L.directionalFlows;