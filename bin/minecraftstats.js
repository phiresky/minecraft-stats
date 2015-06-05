/// <reference path="../lib/jquery.d.ts" />
/// <reference path="../lib/jquery.treetable.d.ts" />
/// <reference path="../lib/highcharts.d.ts" />
/// <reference path="../lib/chosen.jquery.d.ts" />
var gottencount = 0;
var _currentattributes = [], _usernames, _data;
var separateAxes = false;
var config;
// stat.entityKilledBy.Creeper => Stat: Entity Killed By: Creeper
function getStatName(statid, shorter) {
    if (shorter === void 0) { shorter = statid; }
    return statnames[statid] || toTitleCase(shorter.replace(/_/g, " ").replace(/([A-Z])/g, ' $1').replace(/\./g, ": "));
}
// uppercase first letter of every word
function toTitleCase(str) {
    return str.replace(/\w\S*/g, function (txt) { return txt.charAt(0).toUpperCase() + txt.substr(1); });
}
function getFormatter(statid) {
    if (formatters[statid])
        return function () { return formatters[statid](this.value); };
    else
        return function () { return this.value; };
}
var formatters = {
    "stat.playOneMinute": function (x) {
        x = x / 20 / 60;
        if (x < 60)
            return (x | 0) + " min";
        x /= 60;
        if (x < 24)
            return (x | 0) + " h";
        return ((x / 24) | 0) + " d, " + ((x % 24) | 0) + " h";
    }
};
var statnames = {
    "stat.playOneMinute": "Play Time"
};
function statvalToDataval(stat, arr) {
    if (stat === "achievement.exploreAllBiomes")
        return arr.map(function (x) { return x.progress.length; });
    return arr;
}
// convert data from minecraft json to 2d [stat][user] array and stat name array
function parsedata(userdata) {
    var data = [];
    var attrs = [];
    for (var i = 0; i < userdata.length; i++) {
        var user = userdata[i];
        for (var attr in user) {
            var inx = attrs.indexOf(attr);
            if (inx < 0) {
                inx = attrs.push(attr) - 1;
                data[inx] = new Array(userdata.length);
                for (var k = 0; k < data[inx].length; k++)
                    data[inx][k] = 0;
            }
            data[inx][i] = user[attr];
        }
    }
    // sort data (TODO: less bullshitty solution
    attrs.forEach(function (e, i) {
        data[i]._sort = e;
    });
    attrs = attrs.sort();
    data = data.sort(function (a, b) { return a._sort.localeCompare(b._sort); });
    return {
        data: data,
        attrs: attrs
    };
}
function maketable(users, data) {
    var headers = $("<tr>");
    $("<th class='firstcolumn'>Eigenschaft</th>").appendTo(headers);
    users.forEach(function (user) { return $("<th>").text(user).appendTo(headers); });
    var table = $("<table class='table table-bordered table-striped'>").append(headers);
    var ins = [];
    var prefixExisting = {};
    data.data.forEach(function (row, i) {
        var attr = data.attrs[i];
        var dotIndex = attr.indexOf("."), lastDotIndex = -1;
        var prefix = "", lastprefix = "";
        while (dotIndex >= 0) {
            prefix = attr.substr(0, dotIndex);
            if (!prefixExisting[prefix]) {
                prefixExisting[prefix] = true;
                var statname = getStatName(attr.substring(lastDotIndex + 1, dotIndex));
                ins.push($("<tr><td>" + statname + "</td></tr>")
                    .attr("data-tt-id", prefix)
                    .attr("data-tt-parent-id", lastprefix));
            }
            lastDotIndex = dotIndex;
            dotIndex = attr.indexOf(".", dotIndex + 1);
            lastprefix = prefix;
        }
        ins.push($("<tr>")
            .attr("data-tt-parent-id", prefix)
            .attr("data-tt-id", attr)
            .attr("id", "attr-" + attr)
            .click(function () {
            var attr = $(this).data("ttId");
            var attrs = _currentattributes.slice();
            var inx = attrs.indexOf(attr);
            if (inx >= 0)
                attrs.splice(inx, 1);
            else
                attrs.push(attr);
            makechart(_usernames, attrs, _data);
        })
            .append($("<td>").text(getStatName(attr.substr(lastDotIndex + 1))))
            .append(statvalToDataval(attr, row).map(function (val) {
            return $("<td>").text(val);
        })));
    });
    table.append(ins);
    table.treetable({
        expandable: true,
        clickableNodeNames: true
    });
    return table;
}
function makechart(allusers, attributes, datainfo) {
    $("#attribute").val(attributes).trigger("chosen:updated");
    attributes = attributes || [];
    if (search.indexOf("random") < 0)
        history.replaceState(null, '', "#" + attributes.join("+"));
    _currentattributes.forEach(function (att) {
        $("tr[id='attr-" + att + "']").removeClass("success");
    });
    _currentattributes = attributes;
    _currentattributes.forEach(function (att) {
        $("tr[id='attr-" + att + "']").addClass("success");
    });
    var alldata = attributes.map(function (attribute, index) {
        return {
            name: getStatName(attribute),
            stat: attribute,
            data: statvalToDataval(attribute, datainfo.data[datainfo.attrs.indexOf(attribute)]),
            yAxis: separateAxes ? index : 0
        };
    });
    // remove users without stats
    var users = allusers, data = alldata; // = [], =[]
    //for(var i=0;i<alldata.length;i++) {
    //	if(alldata[i]!==undefined) { users.push(allusers[i]); data.push(alldata[i]); }
    //}
    function getAxis(title, formatter) {
        if (title === void 0) { title = "Count"; }
        var x = {
            min: 0,
            title: { text: title }
        };
        if (formatter)
            x.labels = { formatter: formatter };
        return x;
    }
    ;
    var axis = getAxis();
    if (separateAxes)
        axis = data.map(function (serie) { return getAxis(serie.name, getFormatter(serie.stat)); });
    else if (data.length == 1)
        axis = getAxis(data[0].name, getFormatter(data[0].stat));
    $('#chart').highcharts({
        chart: {
            type: 'column'
        },
        title: {
            text: data.map(function (serie) { return serie.name; }).join(", ")
        },
        subtitle: {
            text: 'Source: ' + config.servername
        },
        xAxis: {
            categories: users
        },
        yAxis: axis,
        tooltip: {
            formatter: function () {
                return this.points[0].key +
                    '<table>' +
                    this.points.map(function (point) {
                        var val = point.y;
                        var formatter = formatters[point.series.options.stat];
                        if (formatter)
                            val = formatter(val);
                        return '<tr>'
                            + '<td style="color:' + point.series.color + ';padding:0">' + point.series.name + '</td>'
                            + '<td style="padding-left:5px"><b>' + val + '</b></td>'
                            + '</tr>';
                    }).join("") +
                    '</table>';
            },
            shared: true,
            useHTML: true
        },
        plotOptions: {
            column: {
                /*pointPadding: 0.2,
                borderWidth: 0,*/
                showInLegend: attributes.length > 1
            }
        },
        series: data
    });
}
function initdisplay(userdata, users) {
    var data = parsedata(userdata);
    if (data.attrs.length === 0)
        throw new Error("No Stats found");
    var usernames = users.map(function (x) {
        return x.name || x.id;
    });
    maketable(usernames, data).appendTo("#table");
    _data = data;
    _usernames = usernames;
    var opts = {};
    data.attrs.forEach(function (attr) {
        var prefix = attr.split(".")[0];
        var suffix = attr.substring(prefix.length + 1);
        opts[prefix] = opts[prefix] || $("<optgroup>").attr("label", getStatName(prefix));
        $("<option>").val(attr).text(getStatName(attr, suffix)).appendTo(opts[prefix]);
    });
    $("#options #separate").change(function () {
        separateAxes = this.checked;
        makechart(usernames, _currentattributes, data);
    });
    function randomchart() {
        var vals = [data.attrs[(Math.random() * data.attrs.length) | 0]];
        makechart(usernames, vals, data);
    }
    $("#options #random").click(randomchart);
    $("#options #attribute").append($.map(opts, function (v, k) {
        return v;
    }))
        .chosen()
        .change(function () {
        makechart(usernames, $(this).val() || [], data);
    });
    if (location.hash) {
        var vals = location.hash.substr(1).split("+");
        makechart(usernames, vals, data);
    }
    else if (true || search.indexOf("random") >= 0) {
        randomchart();
    }
}
var search = [];
$(function () {
    $.getJSON("config.json", function (x) {
        config = x;
        if (location.search)
            search = location.search.substr(1).split("&");
        if (search.indexOf("light") >= 0)
            $(".nonlight").hide();
        $.getJSON(config.usercachepath, function (r) {
            var targetcount = r.length;
            var userdata = [];
            var users = [];
            for (var u = 0; u < r.length; u++) {
                var user = r[u];
                function getresp(user, resp) {
                    if (resp['stat.playOneMinute'] < 20 * config.userMinimumOntime)
                        return;
                    userdata.push(resp);
                    users.push(user);
                }
                $.getJSON(config.statspath + user.uuid + ".json", getresp.bind(null, user))
                    .fail(function () {
                    console.log("user " + user.name + " not found");
                })
                    .always(function () {
                    gottencount++;
                    if (gottencount == targetcount) {
                        if (gottencount === 0)
                            console.error("No data gotten!");
                        else
                            initdisplay(userdata, users);
                    }
                });
            }
        });
    }).fail(function (x, err) {
        console.log("Error loading config.json: " + err);
    });
});
//# sourceMappingURL=minecraftstats.js.map