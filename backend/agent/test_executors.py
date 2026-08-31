""" Tests for functions inside executors.py """

from django.test import SimpleTestCase

from .executors import _infer_value_type

class InferValueTypeTests(SimpleTestCase):
    def test_empty_list_defaults_to_string(self):
        values = []
        result = _infer_value_type(values)
        self.assertEqual(result, "string")
    def test_empty_markers_default_to_string(self):
        values = [None, "", "-"]
        result = _infer_value_type(values)
        self.assertEqual(result, "string")
    def test_numeric_values_are_inferred_as_number(self):
        values = ["10", "20.5", "1,000", "-10,000,000", ".245"]
        result = _infer_value_type(values)
        self.assertEqual(result, "number")
    def test_boolean_values_are_inferred_as_boolean(self):
        values = ["true", "false", "yes", "no"]
        result = _infer_value_type(values)
        self.assertEqual(result, "boolean")
    def test_text_values_are_inferred_as_string(self):
        values = ["alice", "bob", "maxwell", "ray"]
        result = _infer_value_type(values)
        self.assertEqual(result, "string")
    def test_exactly_80_percent_numeric_is_number(self):
        values = ["10", "20", "30", "40", "unknown"]
        result = _infer_value_type(values)
        self.assertEqual(result, "number")
    def test_less_than_80_percent_numeric_is_string(self):
        values = ["10", "20", "30", "apple", "pear"]
        result = _infer_value_type(values)
        self.assertEqual(result, "string")
    def test_zero_and_one_are_treated_as_boolean(self):
        values = ["1", "1", "0", "1", "0", "0"]
        result = _infer_value_type(values)
        self.assertEqual(result, "boolean")
