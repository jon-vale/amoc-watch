"""Optional NetCDF readers. Install requirements-science.txt before use."""

from __future__ import annotations

from .profiles import Profile


def read_argo_profile(path: str) -> list[Profile]:
    import numpy as np
    import xarray as xr

    dataset = xr.open_dataset(path, decode_cf=True)
    profiles = []
    count = int(dataset.sizes.get("N_PROF", 1))
    for index in range(count):
        selector = {"N_PROF": index} if "N_PROF" in dataset.sizes else {}
        def choose(adjusted, raw):
            if adjusted in dataset:
                candidate = dataset[adjusted].isel(**selector).values
                if np.isfinite(candidate).sum() >= 3:
                    return adjusted, candidate
            return raw, dataset[raw].isel(**selector).values
        pressure_name, pressure = choose("PRES_ADJUSTED", "PRES")
        temperature_name, temperature = choose("TEMP_ADJUSTED", "TEMP")
        salinity_name, salinity = choose("PSAL_ADJUSTED", "PSAL")
        qc_name = f"{salinity_name}_QC"
        quality = []
        for value in dataset[qc_name].isel(**selector).values:
            decoded = value.decode() if hasattr(value, "decode") else value
            try:
                quality.append(int(decoded))
            except (TypeError, ValueError):
                quality.append(9)
        timestamp = dataset["JULD"].isel(**selector).values.astype("datetime64[s]").astype(str)
        profiles.append(Profile(
            source="argo", profile_id=f"{path}:{index}", observed_at=timestamp,
            latitude=float(dataset["LATITUDE"].isel(**selector).values), longitude=float(dataset["LONGITUDE"].isel(**selector).values),
            pressure_dbar=pressure.tolist(), temperature_c=temperature.tolist(), salinity_psu=salinity.tolist(), quality=quality,
            provisional=str(dataset["DATA_MODE"].isel(**selector).values).strip().strip("b'") != "D" if "DATA_MODE" in dataset else True,
        ))
    return profiles


def read_en4_analysis(path: str):
    import xarray as xr

    dataset = xr.open_dataset(path, decode_cf=True)
    required = {"temperature", "salinity"}
    missing = required - set(dataset.data_vars)
    if missing:
        raise ValueError(f"EN4 analysis missing variables: {sorted(missing)}")
    return dataset
