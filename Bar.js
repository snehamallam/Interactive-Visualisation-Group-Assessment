const margin = { top: 70, right: 40, bottom: 80, left: 80 },
      width = 620 - margin.left - margin.right,
      height = 430 - margin.top - margin.bottom;

const svg = d3.select("#chart")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .style("display", "block")
    .style("margin", "0 auto")
    .style("background", "#efefef");

const chartGroup = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

const xAxisGroup = chartGroup.append("g")
    .attr("transform", `translate(0,${height})`);

const yAxisGroup = chartGroup.append("g");
const gridGroup = chartGroup.append("g");
const barsGroup = chartGroup.append("g");
const labelsGroup = chartGroup.append("g");

const legendGroup = svg.append("g")
    .attr("transform", `translate(${margin.left - 45}, 30)`);

const tooltip = d3.select("body")
    .append("div")
    .attr("id", "stackTooltip")
    .style("position", "absolute")
    .style("background", "rgba(30,30,30,0.95)")
    .style("color", "#fff")
    .style("padding", "10px 12px")
    .style("border-radius", "8px")
    .style("font-size", "12px")
    .style("line-height", "1.5")
    .style("pointer-events", "none")
    .style("opacity", 0);

const attendanceGroups = ["Below 90%", "High Attendance (90%+)"];
const scoreKeys = ["Score ≥ 70", "Score < 70"];

const colors = {
    "Score ≥ 70": "#006400",
    "Score < 70": "#4d8647"
};

let fullData = [];

d3.select("#chartInsight").style("opacity", 1);

d3.csv("IV_Dataset.csv").then(function(data) {
    data.forEach(d => {
        d.Attendance = +d.Attendance;
        d.Exam_Score = +d.Exam_Score;
    });

    fullData = data;

    drawLegend();
    updateChart("All");
    updateInsightText("All");

    d3.select("#genderFilter").on("change", function() {
        const filterValue = this.value;
        updateChart(filterValue);
        updateInsightText(filterValue);
    });
});

function getFilteredData(filterValue) {
    if (filterValue === "All") return fullData;
    return fullData.filter(d => d.Gender === filterValue);
}

function getAttendanceGroup(attendance) {
    return attendance < 90 ? "Below 90%" : "High Attendance (90%+)";
}

function getScoreCategory(score) {
    return score >= 70 ? "Score ≥ 70" : "Score < 70";
}

function prepareChartData(data) {
    const grouped = {
        "Below 90%": {
            group: "Below 90%",
            "Score ≥ 70": 0,
            "Score < 70": 0,
            total: 0
        },
        "High Attendance (90%+)": {
            group: "High Attendance (90%+)",
            "Score ≥ 70": 0,
            "Score < 70": 0,
            total: 0
        }
    };

    data.forEach(d => {
        const attendanceGroup = getAttendanceGroup(d.Attendance);
        const scoreCategory = getScoreCategory(d.Exam_Score);

        grouped[attendanceGroup][scoreCategory] += 1;
        grouped[attendanceGroup].total += 1;
    });

    return attendanceGroups.map(group => {
        const item = grouped[group];
        const total = item.total === 0 ? 1 : item.total;

        return {
            group: group,
            "Score ≥ 70": (item["Score ≥ 70"] / total) * 100,
            "Score < 70": (item["Score < 70"] / total) * 100,
            countHigh: item["Score ≥ 70"],
            countLow: item["Score < 70"],
            total: item.total
        };
    });
}

function updateChart(filterValue) {
    const filteredData = getFilteredData(filterValue);
    const chartData = prepareChartData(filteredData);

    barsGroup.transition().duration(250).style("opacity", 0);
    labelsGroup.transition().duration(250).style("opacity", 0);
    xAxisGroup.transition().duration(250).style("opacity", 0);
    yAxisGroup.transition().duration(250).style("opacity", 0);
    gridGroup.transition().duration(250).style("opacity", 0);

    setTimeout(() => {
        const x = d3.scaleBand()
            .domain(attendanceGroups)
            .range([0, width])
            .padding(0.18);

        const y = d3.scaleLinear()
            .domain([0, 100])
            .range([height, 0]);

        const stack = d3.stack().keys(scoreKeys);
        const stackedData = stack(chartData);

        const yTicks = [0, 20, 40, 60, 80, 100];

        gridGroup.call(
            d3.axisLeft(y)
                .tickValues(yTicks)
                .tickSize(-width)
                .tickFormat("")
        );

        gridGroup.selectAll("line")
            .attr("stroke", "#cfcfcf")
            .attr("stroke-dasharray", "1,4")
            .attr("stroke-width", 1);

        gridGroup.select(".domain").remove();

        xAxisGroup.call(d3.axisBottom(x));
        xAxisGroup.select(".domain").remove();
        xAxisGroup.selectAll("line").remove();
        xAxisGroup.selectAll("text")
            .style("font-size", "13px")
            .style("fill", "#666");

        yAxisGroup.call(
            d3.axisLeft(y)
                .tickValues(yTicks)
                .tickFormat(d => `${d}%`)
        );

        yAxisGroup.select(".domain").remove();
        yAxisGroup.selectAll("line").remove();
        yAxisGroup.selectAll("text")
            .style("font-size", "13px")
            .style("fill", "#666");

        const seriesGroups = barsGroup.selectAll(".series")
            .data(stackedData, d => d.key);

        const seriesEnter = seriesGroups.enter()
            .append("g")
            .attr("class", "series");

        seriesEnter.merge(seriesGroups)
            .attr("fill", d => colors[d.key]);

        seriesGroups.exit().remove();

        const rects = barsGroup.selectAll(".series")
            .selectAll("rect")
            .data(d => d.map(v => ({ ...v, key: d.key })));

        const rectsEnter = rects.enter()
            .append("rect")
            .attr("x", d => x(d.data.group))
            .attr("y", height)
            .attr("width", x.bandwidth())
            .attr("height", 0)
            .on("mouseover", function(event, d) {
                const percentage = (d[1] - d[0]).toFixed(2);
                const count = d.key === "Score ≥ 70" ? d.data.countHigh : d.data.countLow;

                d3.select(this)
                    .attr("opacity", 0.9)
                    .attr("stroke", "#1d1d1d")
                    .attr("stroke-width", 1);

                tooltip
                    .style("opacity", 1)
                    .html(`
                        <strong>Attendance Group:</strong> ${d.data.group}<br>
                        <strong>Score Category:</strong> ${d.key}<br>
                        <strong>Percentage:</strong> ${percentage}%<br>
                        <strong>Students:</strong> ${count}<br>
                        <strong>Gender:</strong> ${filterValue}
                    `);
            })
            .on("mousemove", function(event) {
                tooltip
                    .style("left", (event.pageX + 12) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                d3.select(this)
                    .attr("opacity", 1)
                    .attr("stroke", "none");

                tooltip.style("opacity", 0);
            });

        rectsEnter.merge(rects)
            .transition()
            .duration(700)
            .attr("x", d => x(d.data.group))
            .attr("width", x.bandwidth())
            .attr("y", d => y(d[1]))
            .attr("height", d => y(d[0]) - y(d[1]));

        rects.exit()
            .transition()
            .duration(400)
            .attr("y", height)
            .attr("height", 0)
            .remove();

        const labelData = [];
        stackedData.forEach(series => {
            series.forEach(d => {
                const value = d[1] - d[0];
                if (value > 0) {
                    labelData.push({
                        group: d.data.group,
                        key: series.key,
                        value: value,
                        y0: d[0],
                        y1: d[1]
                    });
                }
            });
        });

        const labels = labelsGroup.selectAll(".bar-label")
            .data(labelData, d => `${d.group}-${d.key}`);

        const labelsEnter = labels.enter()
            .append("text")
            .attr("class", "bar-label")
            .attr("text-anchor", "middle")
            .style("fill", "white")
            .style("font-size", "14px")
            .style("font-weight", "600")
            .attr("x", d => x(d.group) + x.bandwidth() / 2)
            .attr("y", height)
            .text(d => `${d.value.toFixed(2)}%`);

        labelsEnter.merge(labels)
            .transition()
            .duration(700)
            .attr("x", d => x(d.group) + x.bandwidth() / 2)
            .attr("y", d => y((d.y0 + d.y1) / 2))
            .text(d => `${d.value.toFixed(2)}%`);

        labels.exit()
            .transition()
            .duration(400)
            .attr("y", height)
            .remove();

        drawAxisTitles();

        barsGroup.transition().duration(450).style("opacity", 1);
        labelsGroup.transition().duration(450).style("opacity", 1);
        xAxisGroup.transition().duration(450).style("opacity", 1);
        yAxisGroup.transition().duration(450).style("opacity", 1);
        gridGroup.transition().duration(450).style("opacity", 1);
    }, 250);
}

function drawAxisTitles() {
    chartGroup.selectAll(".axis-title").remove();

    chartGroup.append("text")
        .attr("class", "axis-title")
        .attr("x", width / 2)
        .attr("y", height + 55)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-weight", "600")
        .style("fill", "#333")
        .text("Attendance_Group");

    chartGroup.append("text")
        .attr("class", "axis-title")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -42)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-weight", "600")
        .style("fill", "#333")
        .text("Percentage of Students");
}

function drawLegend() {
    legendGroup.selectAll("*").remove();

    legendGroup.append("text")
        .attr("x", 0)
        .attr("y", 0)
        .style("font-size", "13px")
        .style("font-weight", "600")
        .style("fill", "#555")
        .text("Score_Category");

    const legendItems = legendGroup.selectAll(".legend-item")
        .data(scoreKeys)
        .enter()
        .append("g")
        .attr("class", "legend-item")
        .attr("transform", (d, i) => `translate(${135 + i * 120}, -8)`);

    legendItems.append("circle")
        .attr("cx", 0)
        .attr("cy", 5)
        .attr("r", 6)
        .attr("fill", d => colors[d]);

    legendItems.append("text")
        .attr("x", 12)
        .attr("y", 9)
        .style("font-size", "13px")
        .style("fill", "#666")
        .text(d => d);
}

function updateInsightText(filterValue) {
    const filteredData = getFilteredData(filterValue);
    const chartData = prepareChartData(filteredData);

    const below = chartData.find(d => d.group === "Below 90%");
    const high = chartData.find(d => d.group === "High Attendance (90%+)");

    let label = "all students";
    if (filterValue === "Male") label = "male students";
    if (filterValue === "Female") label = "female students";

    const insightHTML = `
        <div class="insight-box">
            <div class="insight-title">Key Insight</div>
            <p class="insight-text">
                The chart indicates that attendance has a strong positive association with exam performance.
                Among <strong>${label}</strong>, students with <strong>90% or higher attendance</strong>
                are much more likely to score <strong>70 or above</strong> than those in the
                <strong>Below 90%</strong> attendance group. This suggests that consistent attendance
                may play an important role in improving academic achievement.
            </p>
        </div>
    `;

    d3.select("#chartInsight")
        .transition()
        .duration(200)
        .style("opacity", 0)
        .on("end", function() {
            d3.select(this)
                .html(insightHTML)
                .transition()
                .duration(400)
                .style("opacity", 1);
        });
}