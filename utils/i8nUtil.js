

'use strict';


class I8nUtil {

    //unused
    getMessage(key, lang, labelsObject) {
        if (!lang) {
            lang = "ES";
        }

        lang = lang.toUpperCase();
        
        var label = "";

        try {
         label = labelsObject[lang][key];
        } catch(e) {
            label = labelsObject["EN"][key];
        }
        return label;
     
    }

   


      
  
}


var i8nUtil = new I8nUtil();


module.exports = i8nUtil;