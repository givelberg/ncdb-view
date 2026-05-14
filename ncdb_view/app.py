from pathlib import Path
import tempfile
import io
import os
import logging

from fastapi import FastAPI
from fastapi import Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from fastapi.responses import JSONResponse
from fastapi.responses import FileResponse

from pydantic import BaseModel
from queue import Queue
import threading

from ncdb.api.database import Database
from ncdb.api import FieldCollection

from ncdb.scanners.marine_da_scanner import MarineDAScanner
from ncdb.scanners.obsforge_scanner import ObsForgeScanner


class ScanRequest(BaseModel):
    data_root: str
    scanner: str
    n_cycles: int = -1

class PlotSpec(BaseModel):
    dataset_id: int
    obsspace: str
    variable: str
    attribute: str
    mode: str = "history"

class PlotRequest(BaseModel):
    specs: list[PlotSpec]

class AttributesRequest(BaseModel):
    dataset: int
    obsspace: str
    variable: str


BASE_RUNTIME_DIR = Path(tempfile.gettempdir()) / "ncdb_view"
PLOTS_DIR = BASE_RUNTIME_DIR / "plots"

PLOTS_DIR.mkdir(parents=True, exist_ok=True)

BASE_DIR = Path(__file__).parent
# BASE_DIR = Path(__file__).resolve().parent

app = FastAPI()

# db = Database("cp4.03-parqllel-3dvar.db")


@app.get("/datasets")
def datasets():
    db = app.state.db

    result = []

    for ds in db.datasets():

        result.append({
            "id": ds.id,
            "name": ds.name,
            "root_dir": ds.root_dir,
            "n_cycles": len(ds.cycles),
        })

    return result


@app.get("/obsspaces/{dataset_id}")
def obsspaces(dataset_id: int):
    db = app.state.db
    ds = db.dataset(dataset_id)
    return sorted(ds.list_obsspaces())


@app.get("/variables/{dataset_id}/{obsspace}")
def variables(dataset_id: int, obsspace: str):
    # print("dataset_id:", dataset_id, type(dataset_id))
    db = app.state.db
    ds = db.dataset(dataset_id)
    obs = ds.obsspace(obsspace)

    # return obs.list_variables(group="ObsValue")
    return obs.list_variables()


@app.post("/attributes")
def get_attributes(req: AttributesRequest):
    db = app.state.db
    ds = db.dataset(req.dataset)
    obsspace = ds.obsspace(req.obsspace)
    field = obsspace.field(req.variable)
    attrs = field.list_attributes()

    return {"attributes": attrs}


@app.post("/scan")
def scan(req: ScanRequest):
    db = app.state.db

    q = Queue()
    scanners = {
        "marine": MarineDAScanner,
        "obsforge": ObsForgeScanner,
    }
    scanner_cls = scanners[req.scanner]

    def callback(msg):
        q.put(msg)

    def worker():
        q.put("Starting scan...\n")
        db.scan(
            data_root=req.data_root,
            scanner_cls=scanner_cls,
            n_cycles=req.n_cycles,
            callback=callback
        )
        q.put("Scan complete.\n")
        q.put(None)

    threading.Thread(target=worker).start()

    async def stream():
        while True:
            item = q.get()
            if item is None:
                break
            yield item + "\n"

    return StreamingResponse(
        stream(),
        media_type="text/plain"
    )


@app.post("/plot")
def plot(req: PlotRequest):
    db = app.state.db

    # print(req)

    fc = FieldCollection()

    for spec in req.specs:
        ds = db.dataset(spec.dataset_id)
        obsspace = ds.obsspace(spec.obsspace)
        field = obsspace.field(spec.variable)
        derived = getattr(field, spec.attribute)
        fc.add(derived)

    filename = "multiplot.png"
    plot_path = PLOTS_DIR / filename

    fc.plot(plot_path)

    return {
        "image": f"/plots/{filename}"
    }

# -----------------------------
# serve index.html + app.js
# -----------------------------

app.mount(
    "/plots",
    StaticFiles(directory=str(PLOTS_DIR)),
    name="plots"
)

app.mount(
    "/",
    StaticFiles(directory=str(BASE_DIR / "static"), html=True),
    name="static"
)
