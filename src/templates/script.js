    console.log("hello world");

    //calcolo numero pagina
    function cutNumber(number, digitsAfterDot) {
      const str = `${number}`;
      return str.slice(0, str.indexOf(".") + digitsAfterDot + 1);
    }
    function getPageOfParagraph(nameDiv) {
      const heightPage = 842;
      var offsetHeight = document.documentElement.clientHeight;
      let offsetDiv = document.getElementById(nameDiv);
      let offsetTop;
      let result;

      offsetTop = offsetDiv.getBoundingClientRect().top;
      const pageNumber = Math.floor(offsetTop / offsetHeight) + 1;
      console.log(nameDiv + " -> " + result + " -> " + pageNumber);

      return pageNumber;
    }

    const arrayOfIndex = [
      "RIEPILOGO_INDAGINE",
      "ANAGRAFICA_IMPRESA",
      "REPERIBILITÀ",
      "OPERATIVITÀ",
      "RECAPITI_TELEFONICI",
      "PARTECIPAZIONI_IN_IMPRESE",
      "PARTECIPAZIONI_SOCI_AGGREDIBILI",
      "NEGATIVITÀ",
      "INDAGINI_NEGOZIALI",
      "VEICOLI",
      "IMMOBILI",
      "APPROFONDIMENTI_IPOTECARI",
      "REPERIBILITÀ_LEGALE_RAPPRESENTANTE",
      "CARICHE_IN_IMPRESE_ATTUALI_LEGALE_RAPPRESENTANTE",
      "CARICHE_IN_IMPRESE_PREGRESSE_LEGALE_RAPPRESENTANTE",
      "PARTECIPAZIONI_LEGALE_RAPPRESENTANTE",
      "RAPPORTI_BANCARI_LEGALE_RAPPRESENTANTE",
      "RAPPORTI_BANCARI",
      "GIUDIZIO_RECUPERABILITÀ"
    ];

    function updateTableOfContents(){
        document.body.style.backgroundColor = 'red';
    const list = [...arrayOfIndex];

    for (let i = 0; i < list.length; i++) {
      const element = document.getElementById(list[i]);
      if (!element) {
        arrayOfIndex.splice(arrayOfIndex.findIndex(el => el == list[i]), 1)
      }
    }


    for (let i = 0; i < arrayOfIndex.length; i++) {
      //prendo tutti gli indici delle sezioni
      let div = document.getElementsByClassName("contenuti__row__dx");

      let p = div[i].getElementsByClassName("regular");
      const element = document.getElementById(arrayOfIndex[i]);
      if (element) {
        p.item(0).innerHTML = getPageOfParagraph(arrayOfIndex[i]);
      }
    }
  }