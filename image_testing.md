# Image Testing Guide

## Supported Formats
- PNG, JPG, JPEG, WebP
- Max file size: 5 MB

## Best Practices
1. Use clear, well-lit photos
2. Frame the animal center-frame
3. Avoid obstructed views
4. Side profile works best for horn-based breeds

## Sample Test Images

| Breed        | Key Visual Marker           |
|-------------|-----------------------------|
| Gir          | Distinct forehead hump       |
| Sahiwal      | Reddish coat, loose dewlap   |
| Murrah       | Jet black, tight curled horns|
| Jaffarabadi  | Massive body, heavy horns    |

## Testing Protocol

### Manual Testing Checklist

- [ ] Upload a valid JPG — expect 200 with results
- [ ] Upload a PNG — expect 200 with results
- [ ] Upload a non-image file — expect 400 error
- [ ] Upload > 5 MB — expect error
- [ ] Request without file — expect 422
- [ ] Check /api/breeds returns 12 breeds
- [ ] Check /api/history returns paginated results

### Automated Testing

```bash
cd tests
pytest test_api.py -v
```

## Expected Output

```
tests/test_api.py::TestBreedsEndpoint::test_get_breeds_returns_200 PASSED
tests/test_api.py::TestBreedsEndpoint::test_get_breeds_has_data PASSED
tests/test_api.py::TestRecognizeEndpoint::test_no_file_returns_422 PASSED
tests/test_api.py::TestRecognizeEndpoint::test_with_image_returns_200 PASSED
tests/test_api.py::TestHistoryEndpoint::test_history_returns_200 PASSED
```
