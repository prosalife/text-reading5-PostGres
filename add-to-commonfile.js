// Объединение файлов маршрутов в общую городскую схему

const { nextTick } = require('process');

function init_func() {
    var fs = require('fs');
    const path = require('path'); //requiring path and fs modules


    let obj_prop = fs.readFileSync('obj_prop.json');
    let itog_long = fs.readFileSync('itog_long.json');

    let itog_l = JSON.parse(itog_long);
    let prop = JSON.parse(obj_prop);


    for (let i = 0; i < prop.properties.length; i++) {

        for (let j = 0; j < itog_l.features.length; j++) {
            if (itog_l.features[j].properties.root_id == prop.properties[i].root_id && itog_l.features[j].properties.platform_id == prop.properties[i].platform_id) {
                itog_l.features[j].properties.Distance = prop.properties[i].Distance;
                console.log(" i: " + i + " j: " + j + "  " + prop.properties[i].Distance);
                break;


            }
        }
    }

    //  console.log(itog_l);

    const data = JSON.stringify(itog_l);

    // write JSON string to a file
    fs.writeFile('complite.json', data, (err) => {
        if (err) {
            throw err;
        }
        console.log("JSON data is saved.");
    });


} // конец функции init_func

init_func();