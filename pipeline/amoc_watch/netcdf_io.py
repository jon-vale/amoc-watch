"""Optional NetCDF readers. Install requirements-science.txt before use."""

from __future__ import annotations

from .profiles import Profile


def read_argo_profile(path: str) -> list[Profile]:
    import xarray as xr

    dataset = xr.open_dataset(path, decode_cf=True)
    profiles = []
    count = int(dataset.sizes.get("N_PROF", 1))
    for index in range(count):
        selector = {"N_PROF": index} if "N_PROF" in dataset.sizes else {}
        pressure = dataset["PRES_ADJUSTED" if "PRES_ADJUSTED" in dataset else "PRES"].isel(**selector).values
        temperature = dataset["TEMP_ADJUSTED" if "TEMP_ADJUSTED" in dataset else "TEMP"].isel(**selector).values
        salinity = dataset["PSAL_ADJUSTED" if "PSAL_ADJUSTED" in dataset else "PSAL"].isel(**selector).values
        qc_name = "PSAL_ADJUSTED_QC" if "PSAL_ADJUSTED_QC" in dataset else "PSAL_QC"
        quality = [int(value.decode() if hasattr(value, "decode") else value) for value in dataset[qc_name].isel(**selector).values]
        timestamp = dataset["JULD"].isel(**selector).values.astype("datetime64[s]").astype(str)
        profiles.append(Profile(
            source="argo", profile_id=f"{path}:{index}", observed_at=timestamp,
            latitude=float(dataset["LATITUDE"].isel(**selector).values), longitude=float(dataset["LONGITUDE"].isel(**selector).values),
            pressure_dbar=pressure.tolist(), temperature_c=temperature.tolist(), salinity_psu=salinity.tolist(), quality=quality,
            provisional=str(dataset.get("DATA_MODE", "R").isel(**selector).values).strip() != "D" if "DATA_MODE" in dataset else True,
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
