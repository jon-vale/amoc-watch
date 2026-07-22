import unittest

from amoc_watch.profiles import Profile, aggregate_month, density_eos80, reduce_profile


def synthetic(profile_id="p1", surface_salinity=34.8, provisional=False):
    return Profile(
        source="fixture", profile_id=profile_id, observed_at="2026-06-15T12:00:00Z",
        latitude=55.0, longitude=-35.0,
        pressure_dbar=[0, 10, 50, 100, 200, 500, 1000],
        temperature_c=[10, 9.8, 8, 6, 4, 3, 2],
        salinity_psu=[surface_salinity, 34.82, 34.86, 34.9, 34.95, 35, 35.05],
        quality=[1, 1, 1, 1, 1, 1, 1], provisional=provisional,
    )


class ProfileReductionTests(unittest.TestCase):
    def test_eos80_reference_density(self):
        self.assertAlmostEqual(density_eos80(35, 15), 1025.9728, places=3)

    def test_reduces_profile_to_physical_metrics(self):
        result = reduce_profile(synthetic())
        self.assertEqual(result.month, "2026-06")
        self.assertGreater(result.stratification_0_200m, 0)
        self.assertGreater(result.freshwater_0_1000m, 0)
        self.assertLessEqual(result.mixed_layer_depth, 200)

    def test_quality_control_removes_bad_levels(self):
        profile = synthetic()
        profile = Profile(**{**profile.__dict__, "quality": [1, 1, 4, 1, 1, 1, 1]})
        self.assertEqual(reduce_profile(profile).valid_levels, 6)

    def test_monthly_aggregation_carries_uncertainty_and_coverage(self):
        summary = aggregate_month([reduce_profile(synthetic("p1")), reduce_profile(synthetic("p2", 34.6, True))])
        self.assertEqual(summary["profile_count"], 2)
        self.assertIsNotNone(summary["surface_density"]["uncertainty"])
        self.assertEqual(summary["coverage"]["deep_profile_fraction"], 1)
        self.assertEqual(summary["provisional_fraction"], 0.5)


if __name__ == "__main__":
    unittest.main()
