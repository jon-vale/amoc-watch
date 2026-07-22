from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime
from math import sqrt
from statistics import fmean, stdev
from typing import Iterable, Sequence


REFERENCE_SALINITY = 35.0


@dataclass(frozen=True)
class Profile:
    source: str
    profile_id: str
    observed_at: str
    latitude: float
    longitude: float
    pressure_dbar: Sequence[float]
    temperature_c: Sequence[float]
    salinity_psu: Sequence[float]
    quality: Sequence[int] | None = None
    provisional: bool = False


@dataclass(frozen=True)
class ProfileMetrics:
    source: str
    profile_id: str
    month: str
    latitude: float
    longitude: float
    surface_density: float
    density_200m: float | None
    stratification_0_200m: float | None
    freshwater_0_1000m: float | None
    mixed_layer_depth: float | None
    maximum_pressure: float
    valid_levels: int
    provisional: bool
    thermodynamic_method: str

    def to_dict(self) -> dict:
        return asdict(self)


def density_eos80(salinity: float, temperature: float) -> float:
    """EOS-80 density at atmospheric pressure in kg m-3.

    This is appropriate for deterministic engineering tests. Production
    calibration should use TEOS-10/GSW with Absolute Salinity and Conservative
    Temperature.
    """
    t = temperature
    s = max(0.0, salinity)
    pure = (
        999.842594 + 6.793952e-2 * t - 9.095290e-3 * t**2
        + 1.001685e-4 * t**3 - 1.120083e-6 * t**4 + 6.536332e-9 * t**5
    )
    a = 0.824493 - 4.0899e-3 * t + 7.6438e-5 * t**2 - 8.2467e-7 * t**3 + 5.3875e-9 * t**4
    b = -5.72466e-3 + 1.0227e-4 * t - 1.6546e-6 * t**2
    return pure + a * s + b * s**1.5 + 4.8314e-4 * s**2


def density_teos10(salinity: float, temperature: float, pressure: float, longitude: float, latitude: float) -> float:
    import gsw

    absolute_salinity = float(gsw.SA_from_SP(salinity, pressure, longitude, latitude))
    conservative_temperature = float(gsw.CT_from_t(absolute_salinity, temperature, pressure))
    return 1000.0 + float(gsw.sigma0(absolute_salinity, conservative_temperature))


def _density(profile: Profile, salinity: float, temperature: float, pressure: float) -> tuple[float, str]:
    try:
        return density_teos10(salinity, temperature, pressure, profile.longitude, profile.latitude), "TEOS-10/GSW"
    except ImportError:
        return density_eos80(salinity, temperature), "EOS-80 engineering fallback"


def _clean(profile: Profile) -> list[tuple[float, float, float]]:
    if not (len(profile.pressure_dbar) == len(profile.temperature_c) == len(profile.salinity_psu)):
        raise ValueError("pressure, temperature, and salinity arrays must have equal length")
    rows = []
    for index, (pressure, temperature, salinity) in enumerate(zip(profile.pressure_dbar, profile.temperature_c, profile.salinity_psu)):
        quality = profile.quality[index] if profile.quality is not None else 1
        if quality not in (1, 2) or pressure < 0 or not (-3 <= temperature <= 45) or not (0 < salinity <= 42):
            continue
        rows.append((float(pressure), float(temperature), float(salinity)))
    rows.sort(key=lambda row: row[0])
    deduplicated = {row[0]: row for row in rows}
    return list(deduplicated.values())


def _interpolate(rows: Sequence[tuple[float, float, float]], target: float, column: int) -> float | None:
    if not rows or target < rows[0][0] or target > rows[-1][0]:
        return None
    for left, right in zip(rows, rows[1:]):
        if left[0] <= target <= right[0]:
            if right[0] == left[0]:
                return left[column]
            fraction = (target - left[0]) / (right[0] - left[0])
            return left[column] + fraction * (right[column] - left[column])
    return rows[-1][column] if rows[-1][0] == target else None


def _integrate_freshwater(rows: Sequence[tuple[float, float, float]], limit: float = 1000.0) -> float | None:
    if not rows or rows[0][0] > 10 or rows[-1][0] < limit:
        return None
    knots = sorted({0.0, limit, *[row[0] for row in rows if 0 < row[0] < limit]})
    salinities = [_interpolate(rows, depth, 2) for depth in knots]
    if any(value is None for value in salinities):
        return None
    total = 0.0
    for index in range(len(knots) - 1):
        left = (REFERENCE_SALINITY - salinities[index]) / REFERENCE_SALINITY
        right = (REFERENCE_SALINITY - salinities[index + 1]) / REFERENCE_SALINITY
        total += 0.5 * (left + right) * (knots[index + 1] - knots[index])
    return total


def reduce_profile(profile: Profile) -> ProfileMetrics:
    rows = _clean(profile)
    if len(rows) < 3:
        raise ValueError("profile has fewer than three valid levels")
    surface_t = _interpolate(rows, max(0.0, rows[0][0]), 1)
    surface_s = _interpolate(rows, max(0.0, rows[0][0]), 2)
    surface_pressure = max(0.0, rows[0][0])
    surface_density, method = _density(profile, surface_s, surface_t, surface_pressure)
    t200, s200 = _interpolate(rows, 200.0, 1), _interpolate(rows, 200.0, 2)
    density_200 = _density(profile, s200, t200, 200.0)[0] if t200 is not None and s200 is not None else None
    stratification = density_200 - surface_density if density_200 is not None else None
    mld = None
    for pressure, temperature, salinity in rows:
        if _density(profile, salinity, temperature, pressure)[0] - surface_density >= 0.03:
            mld = pressure
            break
    month = datetime.fromisoformat(profile.observed_at.replace("Z", "+00:00")).strftime("%Y-%m")
    return ProfileMetrics(
        source=profile.source, profile_id=profile.profile_id, month=month,
        latitude=profile.latitude, longitude=profile.longitude,
        surface_density=surface_density, density_200m=density_200,
        stratification_0_200m=stratification,
        freshwater_0_1000m=_integrate_freshwater(rows), mixed_layer_depth=mld,
        maximum_pressure=rows[-1][0], valid_levels=len(rows), provisional=profile.provisional, thermodynamic_method=method,
    )


def _summary(values: Iterable[float | None]) -> dict:
    valid = [value for value in values if value is not None]
    if not valid:
        return {"mean": None, "uncertainty": None, "count": 0}
    uncertainty = stdev(valid) / sqrt(len(valid)) if len(valid) > 1 else None
    return {"mean": fmean(valid), "uncertainty": uncertainty, "count": len(valid)}


def aggregate_month(metrics: Sequence[ProfileMetrics]) -> dict:
    if not metrics:
        raise ValueError("cannot aggregate an empty month")
    months = {item.month for item in metrics}
    if len(months) != 1:
        raise ValueError("all profiles must belong to the same month")
    latitude_min = min(item.latitude for item in metrics)
    latitude_max = max(item.latitude for item in metrics)
    longitude_min = min(item.longitude for item in metrics)
    longitude_max = max(item.longitude for item in metrics)
    latitude_fraction = min(1.0, max(0.0, latitude_max - latitude_min) / 20.0)
    longitude_fraction = min(1.0, max(0.0, longitude_max - longitude_min) / 50.0)
    count_fraction = min(1.0, len(metrics) / 60.0)
    sampling_fraction = sqrt(latitude_fraction * longitude_fraction) * count_fraction
    return {
        "month": next(iter(months)), "profile_count": len(metrics),
        "provisional_fraction": sum(item.provisional for item in metrics) / len(metrics),
        "thermodynamic_methods": sorted({item.thermodynamic_method for item in metrics}),
        "surface_density": _summary(item.surface_density for item in metrics),
        "stratification_0_200m": _summary(item.stratification_0_200m for item in metrics),
        "freshwater_0_1000m": _summary(item.freshwater_0_1000m for item in metrics),
        "mixed_layer_depth": _summary(item.mixed_layer_depth for item in metrics),
        "coverage": {
            "deep_profile_fraction": sum(item.maximum_pressure >= 1000 for item in metrics) / len(metrics),
            "sampling_fraction": sampling_fraction,
            "coverage_method": "profile-count and geographic-span engineering gate v1",
            "latitude_min": latitude_min, "latitude_max": latitude_max,
            "longitude_min": longitude_min, "longitude_max": longitude_max,
        },
    }
