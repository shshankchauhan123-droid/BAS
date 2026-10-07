import fetch from 'node-fetch';

async function test() {
    const params = new URLSearchParams();
    params.append('file_ids', '185,187');
    params.append('mode', 'NEFT');
    params.append('page', '1');
    params.append('page_size', '20');

    console.log("URL:", "http://localhost:8000/api/v1/bank-transactions/case/37/search?" + params.toString());
}
test();
