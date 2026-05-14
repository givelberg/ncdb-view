
let plotSpecs = [];


async function loadDatasets() {

    let response = await fetch("/datasets");
    let datasets = await response.json();

    let select = document.getElementById("datasets");

    select.innerHTML = "";

	datasets.forEach(ds => {

		let option =
			document.createElement("option");

		option.value = ds.id;

		option.text =
			`${ds.name} ${ds.root_dir} (${ds.n_cycles} cycles)`;

		select.appendChild(option);
	});

/*
    datasets.forEach(name => {

        let option = document.createElement("option");

        option.value = name;
        option.text = name;

        select.appendChild(option);
    });
*/

    select.onchange = loadObsSpaces;

    if (datasets.length > 0) {
        loadObsSpaces();
    }
}


async function loadObsSpaces() {

    let dataset =
        document.getElementById("datasets").value;

    let response =
        await fetch(`/obsspaces/${dataset}`);

    let obsspaces =
        await response.json();

    let select =
        document.getElementById("obsspaces");

    select.innerHTML = "";

    obsspaces.forEach(name => {

        let option = document.createElement("option");

        option.value = name;
        option.text = name;

        select.appendChild(option);
    });

    select.onchange = loadVariables;

    if (obsspaces.length > 0) {
        loadVariables();
    }
}


async function loadVariables() {

    let dataset =
        document.getElementById("datasets").value;

    let obsspace =
        document.getElementById("obsspaces").value;

    let response =
        await fetch(
            `/variables/${dataset}/${obsspace}`
        );

    let variables =
        await response.json();

    let select =
        document.getElementById("variables");

    select.innerHTML = "";

    variables.forEach(name => {

        let option = document.createElement("option");

        option.value = name;
        option.text = name;

        select.appendChild(option);
    });

    select.onchange = loadAttributes;

    if (variables.length > 0) {
        loadAttributes();
    }

    document.getElementById("output").textContent =
        JSON.stringify(variables, null, 2);
}

async function loadAttributes() {

    let dataset =
        document.getElementById("datasets").value;

    let obsspace =
        document.getElementById("obsspaces").value;

    let variable =
        document.getElementById("variables").value;

    let response =
        await fetch(
            "/attributes",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    dataset: dataset,
                    obsspace: obsspace,
                    variable: variable
                })
            }
        );

    let result =
        await response.json();

    let select =
        document.getElementById("attributes");

    select.innerHTML = "";

    result.attributes.forEach(name => {

        let option =
            document.createElement("option");

        option.value = name;
        option.text = name;

        select.appendChild(option);
    });
}


/*
async function loadAttributes() {

    let dataset =
        document.getElementById("datasets").value;

    let obsspace =
        document.getElementById("obsspaces").value;

    let variable =
        document.getElementById("variables").value;

	let variable_encoded =
		encodeURIComponent(variable);

	variable_encoded =
		variable_encoded.replace(/\//g, "%2F");

    let response =
        await fetch(
			`/attributes/${dataset}/${obsspace}/${variable_encoded}`
			// `/attributes/${dataset}/${obsspace}/${encodeURIComponent(variable)}`
        );
            // `/attributes/${dataset}/${obsspace}/${variable}`

    let result =
        await response.json();

    let select =
        document.getElementById("attributes");

    select.innerHTML = "";

    result.attributes.forEach(name => {

        let option =
            document.createElement("option");

        option.value = name;
        option.text = name;

        select.appendChild(option);
    });
}
*/





async function runScan() {

    let log =
        document.getElementById("scan_log");

    log.textContent = "";

    let data_root =
        document.getElementById("scan_path").value;

    let scanner =
        document.getElementById("scanner").value;

	let n_cycles =
		parseInt(
			document.getElementById("n_cycles").value
		);

    let response = await fetch(
        "/scan",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                data_root: data_root,
                scanner: scanner,
                n_cycles: n_cycles
            })
        }
    );

    const reader =
        response.body.getReader();

    const decoder =
        new TextDecoder();

    while (true) {

        const { value, done } =
            await reader.read();

        if (done) {
            break;
        }

        log.textContent +=
            decoder.decode(value);

        log.scrollTop = log.scrollHeight;
    }

    await loadDatasets();
}


function addPlotSpec() {

    let dataset_id =
        Number(document.getElementById("datasets").value);

    let obsspace =
        document.getElementById("obsspaces").value;

    let variable =
        document.getElementById("variables").value;

    let attribute =
        document.getElementById("attributes").value;

    let spec = {
        dataset_id: dataset_id,
        obsspace: obsspace,
        variable: variable,
        attribute: attribute,
        mode: "history"
    };

	plotSpecs.push(spec);
	renderPlotSpecs();

    // renderPlotSpecList();
}


function renderPlotSpecList() {

    let div = document.getElementById("plot_spec_list");

    div.innerHTML = "";

    plotSpecs.forEach((s, i) => {

        let line = document.createElement("div");

        line.textContent =
            `${i+1}: ds=${s.dataset_id} ` +
            `${s.obsspace} / ${s.variable} / ${s.attribute}`;

        div.appendChild(line);
    });
}


async function renderPlot() {

	let response = await fetch("/plot", {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			specs: plotSpecs
		})
	});

	let data = await response.json();

	document.getElementById("plot_img").src =
		data.image + "?t=" + Date.now();
}


function renderPlotSpecs() {

    let container = document.getElementById("plot_specs");
    container.innerHTML = "";

    plotSpecs.forEach((spec, idx) => {

        let div = document.createElement("div");

        div.style.border = "1px solid #ccc";
        div.style.margin = "5px";
        div.style.padding = "5px";

        div.innerHTML = `
            <b>${spec.dataset_id}</b>
            ${spec.obsspace}
            ${spec.variable}
            ${spec.attribute}
            <button onclick="removeSpec(${idx})">Remove</button>
        `;

        container.appendChild(div);
    });
}

function removeSpec(i) {
    plotSpecs.splice(i, 1);
    renderPlotSpecs();
}



async function plotHistory() {

    let dataset =
        document.getElementById("datasets").value;

    let obsspace =
        document.getElementById("obsspaces").value;

    let variable =
        document.getElementById("variables").value;

    let attribute =
        document.getElementById("attributes").value;

    let response = await fetch(
        // "/plot/history",
        "/plot",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                dataset: dataset,
                obsspace: obsspace,
                variable: variable,
                attribute: attribute
            })
        }
    );

    let result = await response.json();

    document.getElementById("plot_image").src =
        result.image + "?t=" + Date.now();
}


loadDatasets();
